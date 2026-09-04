import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";

// Admin views need to see EVERY folder/photo, hidden ones included — but
// that can no longer come from a loosened "admins can read all" RLS
// policy on gallery_folders/gallery_photos, because that policy applied
// to the admin's authenticated session everywhere, including when the
// same logged-in browser tab views the PUBLIC site — an admin toggling a
// folder off would still see it there themselves, since RLS has no way to
// know "this request is the admin panel" vs "this request is someone
// previewing the public page." Routing admin reads through supabaseAdmin
// (service role, bypasses RLS entirely) instead decouples the two: public
// pages' direct client queries now strictly follow is_public, full stop.
export const listAllGalleryFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("gallery_folders")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(`Failed to load folders: ${error.message}`);
    return data;
  });

const ListGalleryPhotosSchema = z.object({ folderId: z.string().uuid().optional() });

export const listAllGalleryPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListGalleryPhotosSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("gallery_photos").select("*").order("sort_order");
    if (data.folderId) query = query.eq("folder_id", data.folderId);
    const { data: rows, error } = await query;
    if (error) throw new Error(`Failed to load photos: ${error.message}`);
    return rows;
  });

const AddPhotoSchema = z.object({
  url: z.string().url(),
  storage_path: z.string().min(1),
  caption: z.string().max(300).optional(),
  sort_order: z.number().int().default(0),
  media_type: z.enum(["photo", "video"]).default("photo"),
  folder_id: z.string().uuid().nullable().optional(),
  origin: z.enum(["manual", "project"]).default("manual"),
  // Set when this file was watermarked at upload time (FileDrop's
  // allowWatermarkToggle checkbox) — kept in sync with the same flag the
  // "Add watermark" bulk action sets on already-uploaded photos, so a
  // photo watermarked either way is correctly excluded from being
  // re-offered that action later.
  watermarked: z.boolean().default(false),
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

// The actual watermarking (Canvas) happens client-side before this is
// called — see watermarkImage.ts — since server functions have no DOM.
// This just finalizes it: point the row at the newly-uploaded watermarked
// file, mark it watermarked, and clean up the now-unused original from
// storage. There's no counterpart "remove" function — a photo watermarked
// this way (or via the upload-time checkbox) is permanent by design (see
// the migration comment), which is why the admin UI confirms this before
// calling it.
const ApplyPhotoWatermarkSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  storage_path: z.string().min(1),
  oldStoragePath: z.string().min(1).nullable().optional(),
});

export const applyGalleryPhotoWatermark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ApplyPhotoWatermarkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("gallery_photos")
      .update({ url: data.url, storage_path: data.storage_path, watermarked: true })
      .eq("id", data.id);
    if (error) {
      console.error("applyGalleryPhotoWatermark failed", error);
      throw new Error(`Failed to save watermarked photo: ${error.message}`);
    }

    if (data.oldStoragePath) {
      const { error: removeErr } = await supabaseAdmin.storage
        .from("site-media")
        .remove([data.oldStoragePath]);
      // Best-effort cleanup — the row update above already succeeded, so a
      // leftover orphaned file in storage isn't worth failing the whole
      // action over.
      if (removeErr) {
        console.error("applyGalleryPhotoWatermark: failed to remove old file", removeErr);
      }
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
  // Only meaningful for a folder with no project_id — a project-linked
  // folder's effective visibility always mirrors its project's own
  // is_public instead (see gallery_folder_is_visible() in the
  // 20260829000000_gallery-folder-visibility.sql migration), so
  // updateGalleryFolder below rejects setting this on a linked folder
  // rather than silently accepting a value that wouldn't take effect.
  is_public: z.boolean().optional(),
});

// Default name for a project-linked folder when none was typed — used both
// when first linking a folder to a project and as a fallback if an admin
// clears the name field entirely. A folder that already has a custom name
// keeps it; linking to a project no longer forces the name to follow the
// project's title.
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
    if (payload.project_id && !payload.name?.trim()) {
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
    if (patch.project_id && !patch.name?.trim()) {
      patch.name = await resolveFolderName(supabaseAdmin, patch.project_id);
    }
    if (patch.is_public !== undefined) {
      const linkedProjectId =
        patch.project_id !== undefined
          ? patch.project_id
          : (await supabaseAdmin.from("gallery_folders").select("project_id").eq("id", id).single())
              .data?.project_id;
      if (linkedProjectId) {
        throw new Error(
          "This folder's visibility follows its linked project — change the project's Public toggle instead.",
        );
      }
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
