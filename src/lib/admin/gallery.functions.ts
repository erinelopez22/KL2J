import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
});

export const createGalleryFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FolderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("gallery_folders")
      .insert(data)
      .select()
      .single();
    if (error) {
      console.error("createGalleryFolder failed", error);
      throw new Error(`Failed to create folder: ${error.message}`);
    }
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
    const { error } = await supabaseAdmin.from("gallery_folders").update(patch).eq("id", id);
    if (error) {
      console.error("updateGalleryFolder failed", error);
      throw new Error(`Failed to update folder: ${error.message}`);
    }
    return { ok: true };
  });

// Deletes a folder AND everything inside it: real storage files for every
// photo/video that has one, the gallery_photos rows, then the folder itself.
export const deleteGalleryFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: photos, error: fetchErr } = await supabaseAdmin
      .from("gallery_photos")
      .select("id, storage_path")
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
