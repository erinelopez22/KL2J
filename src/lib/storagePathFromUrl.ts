// Supabase's getPublicUrl() always returns
// ".../storage/v1/object/public/<bucket>/<path>" — some call sites only
// keep the resulting URL (not the path returned alongside it at upload
// time), so this recovers the path when it's needed later, e.g. to delete
// the underlying file when a photo is removed from a form.
export function storagePathFromUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + marker.length));
  } catch {
    return null;
  }
}
