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
    const { syncFolderPhotosToProject } = await import("@/lib/project-gallery-sync.server");
    await syncFolderPhotosToProject(data.folder_id);
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
    const { data: existing } = await supabaseAdmin
      .from("gallery_photos")
      .select("folder_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("gallery_photos").delete().eq("id", data.id);
    if (error) {
      console.error("deleteGalleryPhoto failed", error);
      throw new Error(`Failed to delete photo: ${error.message}`);
    }
    if (data.storage_path) {
      await supabaseAdmin.storage.from("site-media").remove([data.storage_path]);
    }
    const { syncFolderPhotosToProject } = await import("@/lib/project-gallery-sync.server");
    await syncFolderPhotosToProject(existing?.folder_id ?? null);
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
    const { data: existing } = await supabaseAdmin
      .from("gallery_photos")
      .select("folder_id")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("gallery_photos").update(patch).eq("id", id);
    if (error) {
      console.error("updateGalleryPhoto failed", error);
      throw new Error(`Failed to update photo: ${error.message}`);
    }
    if ("folder_id" in patch) {
      const { syncFolderPhotosToProject } = await import("@/lib/project-gallery-sync.server");
      const oldFolderId = existing?.folder_id ?? null;
      await syncFolderPhotosToProject(oldFolderId);
      if (patch.folder_id !== oldFolderId) {
        await syncFolderPhotosToProject(patch.folder_id ?? null);
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
  // (the usual path is auto-creation via syncProjectGallery). A folder can
  // only ever link to one project — gallery_folders.project_id is UNIQUE —
  // so linking to an already-linked project fails with a friendly error.
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
// gallery_photos rows, and the folder itself. For a project-linked folder,
// this also strips the deleted photos/videos out of that project's
// `attachments` (and clears cover_photo_url if it pointed at one of them):
// deleting from the gallery is meant to be a real delete everywhere, not
// just an unlink. A new folder is still recreated automatically (see
// syncProjectGallery) the next time that project is saved with a new photo
// or video attached.
export const deleteGalleryFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: folder, error: folderFetchErr } = await supabaseAdmin
      .from("gallery_folders")
      .select("project_id")
      .eq("id", data.id)
      .single();
    if (folderFetchErr) {
      console.error("deleteGalleryFolder folder fetch failed", folderFetchErr);
      throw new Error(`Failed to delete folder: ${folderFetchErr.message}`);
    }

    const { data: photos, error: fetchErr } = await supabaseAdmin
      .from("gallery_photos")
      .select("id, url, storage_path")
      .eq("folder_id", data.id);
    if (fetchErr) {
      console.error("deleteGalleryFolder photo fetch failed", fetchErr);
      throw new Error(`Failed to delete folder: ${fetchErr.message}`);
    }

    const paths = photos.map((p) => p.storage_path).filter((p): p is string => !!p);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from("site-media").remove(paths);
    }
    if (photos.length > 0) {
      const { error: deletePhotosErr } = await supabaseAdmin
        .from("gallery_photos")
        .delete()
        .eq("folder_id", data.id);
      if (deletePhotosErr) {
        console.error("deleteGalleryFolder photo delete failed", deletePhotosErr);
        throw new Error(`Failed to delete folder: ${deletePhotosErr.message}`);
      }
    }

    if (folder.project_id) {
      const deletedUrls = new Set(photos.map((p) => p.url));
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("attachments, cover_photo_url")
        .eq("id", folder.project_id)
        .single();
      if (project) {
        type Attachment = { url: string; type: "image" | "video" | "document" };
        const remaining = ((project.attachments as unknown as Attachment[]) ?? []).filter(
          (a) => a.type !== "image" && a.type !== "video",
        );
        const updates: { attachments: Attachment[]; cover_photo_url?: string | null } = {
          attachments: remaining,
        };
        if (project.cover_photo_url && deletedUrls.has(project.cover_photo_url)) {
          updates.cover_photo_url = null;
        }
        await supabaseAdmin.from("projects").update(updates).eq("id", folder.project_id);
      }
    }

    const { error } = await supabaseAdmin.from("gallery_folders").delete().eq("id", data.id);
    if (error) {
      console.error("deleteGalleryFolder failed", error);
      throw new Error(`Failed to delete folder: ${error.message}`);
    }
    return { ok: true, deletedPhotoCount: photos.length };
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
    const { data: existing } = await supabaseAdmin
      .from("gallery_photos")
      .select("folder_id")
      .in("id", data.ids);
    const { error } = await supabaseAdmin
      .from("gallery_photos")
      .update({ folder_id: data.folderId })
      .in("id", data.ids);
    if (error) {
      console.error("moveGalleryPhotos failed", error);
      throw new Error(`Failed to move: ${error.message}`);
    }
    const { syncFolderPhotosToProject } = await import("@/lib/project-gallery-sync.server");
    const sourceFolderIds = new Set((existing ?? []).map((r) => r.folder_id));
    for (const folderId of sourceFolderIds) {
      await syncFolderPhotosToProject(folderId);
    }
    await syncFolderPhotosToProject(data.folderId);
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
    const { syncFolderPhotosToProject } = await import("@/lib/project-gallery-sync.server");
    await syncFolderPhotosToProject(data.folderId);
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
      .select("storage_path, folder_id")
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
    const { syncFolderPhotosToProject } = await import("@/lib/project-gallery-sync.server");
    const affectedFolderIds = new Set(rows.map((r) => r.folder_id));
    for (const folderId of affectedFolderIds) {
      await syncFolderPhotosToProject(folderId);
    }
    return { ok: true };
  });
