import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";

const AddPhotoSchema = z.object({
  url: z.string().url(),
  storage_path: z.string().min(1),
  caption: z.string().max(300).optional(),
  sort_order: z.number().int().default(0),
  media_type: z.enum(["photo", "video"]).default("photo"),
  folder_id: z.string().uuid().nullable().optional(),
  origin: z.enum(["manual", "project"]).default("manual"),
});

export const addGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddPhotoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gallery_photos").insert(data);
    if (error) {
      console.error("addGalleryPhoto failed", error);
      throw new Error(`Failed to save photo: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), storage_path: z.string().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gallery_photos").delete().eq("id", data.id);
    if (error) {
      console.error("deleteGalleryPhoto failed", error);
      throw new Error(`Failed to delete photo: ${error.message}`);
    }
    if (data.storage_path) {
      await supabaseAdmin.storage.from("site-media").remove([data.storage_path]);
    }
    return { ok: true };
  });

const UpdatePhotoSchema = z.object({
  id: z.string().uuid(),
  folder_id: z.string().uuid().nullable().optional(),
  caption: z.string().max(300).nullable().optional(),
  sort_order: z.number().int().optional(),
});

export const updateGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdatePhotoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("gallery_photos").update(patch).eq("id", id);
    if (error) {
      console.error("updateGalleryPhoto failed", error);
      throw new Error(`Failed to update photo: ${error.message}`);
    }
    return { ok: true };
  });

const FolderSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  date_start: z.string().nullable().optional(),
  date_end: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  // Manually attaching a folder to a project that doesn't have one yet
  // (the usual path is auto-creation via ensureProjectGalleryFolder). A
  // folder can only ever link to one project — gallery_folders.project_id
  // is UNIQUE — so linking to an already-linked project fails with a
  // friendly error.
  project_id: z.string().uuid().nullable().optional(),
});

// A project-linked folder's name always mirrors its project's title, so a
// manual link always overrides whatever name was typed.
async function resolveFolderName(
  supabaseAdmin: typeof SupabaseAdmin,
  projectId: string,
): Promise<string> {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .single();
  if (error || !project) {
    throw new Error("Linked project not found");
  }
  return project.title;
}

function friendlyFolderError(error: { code?: string; message: string }, action: string): Error {
  if (error.code === "23505") {
    return new Error("That project already has a linked folder.");
  }
  console.error(`${action} failed`, error);
  return new Error(`Failed to ${action.toLowerCase()}: ${error.message}`);
}

export const createGalleryFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FolderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = { ...data };
    if (payload.project_id) {
      payload.name = await resolveFolderName(supabaseAdmin, payload.project_id);
    }

    const { data: row, error } = await supabaseAdmin
      .from("gallery_folders")
      .insert(payload)
      .select()
      .single();
    if (error) throw friendlyFolderError(error, "create folder");
    return row;
  });

const UpdateFolderSchema = FolderSchema.partial().extend({ id: z.string().uuid() });

export const updateGalleryFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateFolderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    if (patch.project_id) {
      patch.name = await resolveFolderName(supabaseAdmin, patch.project_id);
    }
    const { error } = await supabaseAdmin.from("gallery_folders").update(patch).eq("id", id);
    if (error) throw friendlyFolderError(error, "update folder");
    return { ok: true };
  });

// Deletes a folder and everything inside it — the real storage files, the
// gallery_photos rows, and the folder itself. gallery_photos is a project's
// only copy of its media now, so this is a real delete everywhere, not just
// an unlink. A new folder is recreated automatically (see
// ensureProjectGalleryFolder) the next time that project is saved.
export const deleteGalleryFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { deleteGalleryFolderContents } = await import("@/lib/project-gallery-sync.server");
    const deletedPhotoCount = await deleteGalleryFolderContents(data.id);
    return { ok: true, deletedPhotoCount };
  });

const IdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export const moveGalleryPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    IdsSchema.extend({ folderId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("gallery_photos")
      .update({ folder_id: data.folderId })
      .in("id", data.ids);
    if (error) {
      console.error("moveGalleryPhotos failed", error);
      throw new Error(`Failed to move: ${error.message}`);
    }
    return { ok: true };
  });

export const copyGalleryPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    IdsSchema.extend({ folderId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from("gallery_photos")
      .select("url, storage_path, caption, media_type")
      .in("id", data.ids);
    if (fetchErr) {
      console.error("copyGalleryPhotos fetch failed", fetchErr);
      throw new Error(`Failed to copy: ${fetchErr.message}`);
    }
    const { error } = await supabaseAdmin.from("gallery_photos").insert(
      rows.map((r) => ({
        url: r.url,
        storage_path: r.storage_path,
        caption: r.caption,
        media_type: r.media_type,
        folder_id: data.folderId,
        origin: "manual",
      })),
    );
    if (error) {
      console.error("copyGalleryPhotos insert failed", error);
      throw new Error(`Failed to copy: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteGalleryPhotosBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from("gallery_photos")
      .select("storage_path")
      .in("id", data.ids);
    if (fetchErr) {
      console.error("deleteGalleryPhotosBulk fetch failed", fetchErr);
      throw new Error(`Failed to delete: ${fetchErr.message}`);
    }
    const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from("site-media").remove(paths);
    }
    const { error } = await supabaseAdmin.from("gallery_photos").delete().in("id", data.ids);
    if (error) {
      console.error("deleteGalleryPhotosBulk delete failed", error);
      throw new Error(`Failed to delete: ${error.message}`);
    }
    return { ok: true };
  });
