// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

type PublicAttachment = { url: string; path: string; type: "image" | "video" | "document" };
type DesiredItem = { url: string; storage_path: string | null; media_type: "photo" | "video" };

type ProjectAttachment = {
  url: string;
  path: string;
  type: "image" | "video" | "document";
  name: string;
  description?: string;
  isExternalLink?: boolean;
};

// Keeps a project's auto-created gallery folder (one per project, matched by
// project_id) in sync with its public image/video attachments + cover photo.
// Matches existing folder rows by url regardless of origin — a photo an
// admin dropped straight into the folder from /admin/gallery (origin
// 'manual') already got folded into the project's own attachments by
// syncFolderPhotosToProject below, so by the time this runs it's already in
// `attachments` and must not be inserted a second time.
export async function syncProjectGallery(
  projectId: string,
  title: string,
  attachments: PublicAttachment[],
  coverPhotoUrl: string | null | undefined,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existingFolder, error: folderFetchErr } = await supabaseAdmin
    .from("gallery_folders")
    .select("id, name")
    .eq("project_id", projectId)
    .maybeSingle();
  if (folderFetchErr) {
    console.error("syncProjectGallery: folder fetch failed", folderFetchErr);
    return;
  }

  let folderId = existingFolder?.id;
  if (!folderId) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("gallery_folders")
      .insert({ name: title, project_id: projectId })
      .select("id")
      .single();
    if (createErr) {
      console.error("syncProjectGallery: folder create failed", createErr);
      return;
    }
    folderId = created.id;
  } else if (existingFolder && existingFolder.name !== title) {
    await supabaseAdmin.from("gallery_folders").update({ name: title }).eq("id", folderId);
  }
  if (!folderId) return;

  const desired = new Map<string, DesiredItem>();
  for (const a of attachments) {
    if (a.type === "image" || a.type === "video") {
      desired.set(a.url, {
        url: a.url,
        storage_path: a.path,
        media_type: a.type === "image" ? "photo" : "video",
      });
    }
  }
  if (coverPhotoUrl && !desired.has(coverPhotoUrl)) {
    desired.set(coverPhotoUrl, { url: coverPhotoUrl, storage_path: null, media_type: "photo" });
  }

  const { data: existingPhotos, error: photosErr } = await supabaseAdmin
    .from("gallery_photos")
    .select("id, url")
    .eq("folder_id", folderId);
  if (photosErr) {
    console.error("syncProjectGallery: photos fetch failed", photosErr);
    return;
  }

  const existingUrls = new Set((existingPhotos ?? []).map((p) => p.url));
  const toDelete = (existingPhotos ?? []).filter((p) => !desired.has(p.url));
  const toInsert = [...desired.values()].filter((item) => !existingUrls.has(item.url));

  if (toDelete.length > 0) {
    await supabaseAdmin
      .from("gallery_photos")
      .delete()
      .in(
        "id",
        toDelete.map((p) => p.id),
      );
  }
  if (toInsert.length > 0) {
    const { error: insertErr } = await supabaseAdmin.from("gallery_photos").insert(
      toInsert.map((item) => ({
        url: item.url,
        storage_path: item.storage_path,
        media_type: item.media_type,
        folder_id: folderId,
        origin: "project",
        sort_order: 0,
      })),
    );
    if (insertErr) {
      console.error("syncProjectGallery: photos insert failed", insertErr);
    }
  }
}

function filenameFromPath(pathOrUrl: string): string {
  const last = pathOrUrl.split("/").pop() ?? pathOrUrl;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

// The other direction: keeps a project's public `attachments` (image/video
// entries only — document attachments are left untouched) in sync with
// whatever is *currently* sitting in its linked gallery folder, so edits
// made directly in /admin/gallery (upload, delete, drag-move, multi-select
// copy/move/delete) show up on the project without re-saving it. No-op for
// folders that aren't linked to a project. Not called from folder deletion —
// that path deletes the whole folder (nothing left to read), so
// deleteGalleryFolder strips the project's attachments itself instead.
export async function syncFolderPhotosToProject(
  folderId: string | null | undefined,
): Promise<void> {
  if (!folderId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: folder, error: folderErr } = await supabaseAdmin
    .from("gallery_folders")
    .select("project_id")
    .eq("id", folderId)
    .maybeSingle();
  if (folderErr || !folder?.project_id) return;

  const { data: photos, error: photosErr } = await supabaseAdmin
    .from("gallery_photos")
    .select("url, storage_path, media_type, caption")
    .eq("folder_id", folderId)
    .order("sort_order");
  if (photosErr) {
    console.error("syncFolderPhotosToProject: photos fetch failed", photosErr);
    return;
  }

  const { data: project, error: projectErr } = await supabaseAdmin
    .from("projects")
    .select("attachments, cover_photo_url")
    .eq("id", folder.project_id)
    .single();
  if (projectErr || !project) {
    console.error("syncFolderPhotosToProject: project fetch failed", projectErr);
    return;
  }

  const currentAttachments = (project.attachments as unknown as ProjectAttachment[]) ?? [];
  const nonMediaAttachments = currentAttachments.filter(
    (a) => a.type !== "image" && a.type !== "video",
  );
  const mediaAttachments: ProjectAttachment[] = (photos ?? []).map((p) => ({
    url: p.url,
    path: p.storage_path ?? p.url,
    type: p.media_type === "video" ? "video" : "image",
    name: p.caption?.trim() || filenameFromPath(p.storage_path ?? p.url),
    isExternalLink: !p.storage_path,
  }));

  const updates: { attachments: ProjectAttachment[]; cover_photo_url?: string | null } = {
    attachments: [...nonMediaAttachments, ...mediaAttachments],
  };
  if (project.cover_photo_url && !mediaAttachments.some((a) => a.url === project.cover_photo_url)) {
    updates.cover_photo_url = null;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("projects")
    .update(updates)
    .eq("id", folder.project_id);
  if (updateErr) {
    console.error("syncFolderPhotosToProject: project update failed", updateErr);
    return;
  }

  // Once a photo sits in a project's folder it IS that project's attachment,
  // however it got there — normalize origin so a later project-side save
  // (syncProjectGallery) never mistakes it for something it needs to add.
  await supabaseAdmin
    .from("gallery_photos")
    .update({ origin: "project" })
    .eq("folder_id", folderId)
    .neq("origin", "project");
}
