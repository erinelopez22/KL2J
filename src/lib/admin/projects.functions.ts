import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Photos and videos live only in gallery_photos now — attachments holds
// documents only (see src/lib/project-gallery-sync.server.ts).
const AttachmentSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  type: z.literal("document"),
  name: z.string().min(1).max(200),
  description: z.string().max(300).optional(),
  isExternalLink: z.boolean().optional(),
});

const ConfidentialAttachmentSchema = z.object({
  path: z.string().min(1),
  type: z.enum(["image", "video", "document"]),
  name: z.string().min(1).max(200),
  description: z.string().max(300).optional(),
  isExternalLink: z.boolean().optional(),
});

const PhotoPositionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3),
});

const ProjectSchema = z.object({
  title: z.string().min(1).max(200),
  location: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  services: z.array(z.string().max(200)).default([]),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  personnel: z.array(z.string().min(1).max(200)).default([]),
  photo_urls: z.array(z.string().url()).default([]),
  photo_positions: z.record(z.string(), PhotoPositionSchema).default({}),
  attachments: z.array(AttachmentSchema).default([]),
  confidential_attachments: z.array(ConfidentialAttachmentSchema).default([]),
  is_public: z.boolean().default(false),
  size: z.enum(["major", "small"]).default("small"),
  sort_order: z.number().int().default(0),
  inquiry_id: z.string().uuid().optional(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ProjectSchema.extend({ inquiry_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inquiry, error: inquiryErr } = await supabaseAdmin
      .from("inquiries")
      .select("status")
      .eq("id", data.inquiry_id)
      .single();
    if (inquiryErr || !inquiry) {
      throw new Error(`Failed to look up inquiry: ${inquiryErr?.message}`);
    }
    if (inquiry.status === "Rejected" || inquiry.status === "Cancelled") {
      throw new Error(`Can't link a project to a ${inquiry.status.toLowerCase()} inquiry.`);
    }
    const { data: created, error } = await supabaseAdmin
      .from("projects")
      .insert(data)
      .select("id")
      .single();
    if (error) {
      console.error("createProject failed", error);
      throw new Error(`Failed to create project: ${error.message}`);
    }
    const { ensureProjectGalleryFolder } = await import("@/lib/project-gallery-sync.server");
    await ensureProjectGalleryFolder(created.id, data.title);
    const { syncInquiryAttachmentsToProject } = await import("@/lib/project-inquiry-sync.server");
    await syncInquiryAttachmentsToProject(created.id, data.inquiry_id);
    return { ok: true, id: created.id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ProjectSchema.partial().extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (rest.inquiry_id) {
      const { data: current } = await supabaseAdmin
        .from("projects")
        .select("inquiry_id")
        .eq("id", id)
        .single();
      // Only validate when the link is actually changing — an already-linked
      // inquiry that later gets rejected/cancelled shouldn't block unrelated
      // edits to a project that's already keeping that link.
      if (rest.inquiry_id !== current?.inquiry_id) {
        const { data: inquiry, error: inquiryErr } = await supabaseAdmin
          .from("inquiries")
          .select("status")
          .eq("id", rest.inquiry_id)
          .single();
        if (inquiryErr || !inquiry) {
          throw new Error(`Failed to look up inquiry: ${inquiryErr?.message}`);
        }
        if (inquiry.status === "Rejected" || inquiry.status === "Cancelled") {
          throw new Error(`Can't link a project to a ${inquiry.status.toLowerCase()} inquiry.`);
        }
      }
    }
    const { error } = await supabaseAdmin.from("projects").update(rest).eq("id", id);
    if (error) {
      console.error("updateProject failed", error);
      throw new Error(`Failed to update project: ${error.message}`);
    }

    // Re-select rather than trusting `rest` — callers like togglePublic
    // only send {id, is_public}, so this is the only reliable way to keep
    // the gallery folder name and inquiry sync current after every save.
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("projects")
      .select("title, inquiry_id")
      .eq("id", id)
      .single();
    if (fetchErr || !row) {
      throw new Error(`Failed to re-read project after update: ${fetchErr?.message}`);
    }
    const { ensureProjectGalleryFolder } = await import("@/lib/project-gallery-sync.server");
    await ensureProjectGalleryFolder(id, row.title);
    if (row.inquiry_id) {
      const { syncInquiryAttachmentsToProject } = await import("@/lib/project-inquiry-sync.server");
      await syncInquiryAttachmentsToProject(id, row.inquiry_id);
    }
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // gallery_photos is this project's only copy of its media, and its
    // folder_id -> gallery_folders FK is ON DELETE SET NULL (not CASCADE),
    // so deleting the project row first would orphan the photos as
    // "Unsorted" instead of removing them. Delete the folder's contents
    // explicitly first.
    const { data: folder } = await supabaseAdmin
      .from("gallery_folders")
      .select("id")
      .eq("project_id", data.id)
      .maybeSingle();
    if (folder) {
      const { deleteGalleryFolderContents } = await import("@/lib/project-gallery-sync.server");
      await deleteGalleryFolderContents(folder.id);
    }

    const { data: row } = await supabaseAdmin
      .from("projects")
      .select("photo_urls, attachments, confidential_attachments")
      .eq("id", data.id)
      .single();
    if (row) {
      const { storagePathFromUrl } = await import("@/lib/storagePathFromUrl");
      const { removeStoragePaths } = await import("@/lib/storageCleanup.server");
      const photoUrls = (row.photo_urls as unknown as string[]) ?? [];
      const attachments = (row.attachments as unknown as z.infer<typeof AttachmentSchema>[]) ?? [];
      const confidential =
        (row.confidential_attachments as unknown as z.infer<typeof ConfidentialAttachmentSchema>[]) ?? [];
      const siteMediaPaths = [
        ...photoUrls.map((url) => storagePathFromUrl(url, "site-media")),
        ...attachments.filter((a) => !a.isExternalLink).map((a) => a.path),
      ].filter((p): p is string => !!p);
      const confidentialPaths = confidential
        .filter((a) => !a.isExternalLink)
        .map((a) => a.path)
        .filter((p): p is string => !!p);
      await removeStoragePaths("site-media", siteMediaPaths);
      await removeStoragePaths("confidential-media", confidentialPaths);
    }

    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) {
      console.error("deleteProject failed", error);
      throw new Error(`Failed to delete project: ${error.message}`);
    }
    return { ok: true };
  });
