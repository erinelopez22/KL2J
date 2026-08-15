// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

type PublicAttachment = { url: string; path: string; type: "image" | "video" | "document" };
type DesiredItem = { url: string; storage_path: string | null; media_type: "photo" | "video" };

// Keeps a project's auto-created gallery folder (one per project, matched by
// project_id) in sync with its public image/video attachments + cover photo.
// Only touches gallery_photos rows with origin='project' — anything an
// admin drops into the folder directly from /admin/gallery has origin
// 'manual' and is never added or removed by this sync.
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
    .eq("folder_id", folderId)
    .eq("origin", "project");
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
