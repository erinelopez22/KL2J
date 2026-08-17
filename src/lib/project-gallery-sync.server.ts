// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

// gallery_photos is the sole source of truth for a project's photos/videos
// (projects.attachments holds documents only) — there is nothing left to
// sync between the two. This is the only remaining touchpoint: keep a
// project's one linked gallery folder (matched by project_id, UNIQUE)
// existing and named after the project. Throws on failure so callers
// (createProject/updateProject) surface it to the admin instead of silently
// succeeding with a project that has no working folder.
export async function ensureProjectGalleryFolder(
  projectId: string,
  title: string,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("gallery_folders")
    .select("id, name")
    .eq("project_id", projectId)
    .maybeSingle();
  if (fetchErr) throw new Error(`Failed to look up gallery folder: ${fetchErr.message}`);

  if (!existing) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("gallery_folders")
      .insert({ name: title, project_id: projectId })
      .select("id")
      .single();
    if (createErr) throw new Error(`Failed to create gallery folder: ${createErr.message}`);
    return created.id;
  }

  if (existing.name !== title) {
    const { error: renameErr } = await supabaseAdmin
      .from("gallery_folders")
      .update({ name: title })
      .eq("id", existing.id);
    if (renameErr) throw new Error(`Failed to rename gallery folder: ${renameErr.message}`);
  }
  return existing.id;
}

// Deletes a gallery folder and everything inside it — the real storage
// files, the gallery_photos rows, and the folder row itself. Shared by
// deleteGalleryFolder (src/lib/admin/gallery.functions.ts) and deleteProject
// (src/lib/admin/projects.functions.ts), since gallery_photos is now a
// project's only copy of its media — deleting either the folder directly or
// the project it belongs to must remove that media for real, not just
// unlink it.
export async function deleteGalleryFolderContents(folderId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: photos, error: fetchErr } = await supabaseAdmin
    .from("gallery_photos")
    .select("id, storage_path")
    .eq("folder_id", folderId);
  if (fetchErr) throw new Error(`Failed to look up folder photos: ${fetchErr.message}`);

  const paths = (photos ?? []).map((p) => p.storage_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from("site-media").remove(paths);
  }
  if (photos && photos.length > 0) {
    const { error: deletePhotosErr } = await supabaseAdmin
      .from("gallery_photos")
      .delete()
      .eq("folder_id", folderId);
    if (deletePhotosErr) throw new Error(`Failed to delete photos: ${deletePhotosErr.message}`);
  }

  const { error: deleteFolderErr } = await supabaseAdmin
    .from("gallery_folders")
    .delete()
    .eq("id", folderId);
  if (deleteFolderErr) throw new Error(`Failed to delete folder: ${deleteFolderErr.message}`);

  return photos?.length ?? 0;
}
