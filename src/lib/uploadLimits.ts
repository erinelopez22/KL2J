// Admin uploads (photos/videos/documents/confidential files) go directly
// from the browser to Supabase Storage via a signed upload URL — the app
// server only mints the token (a small JSON call), so this ceiling is just
// a sane app-level limit, not constrained by Cloud Run's request body cap.
export const MAX_ADMIN_UPLOAD_BYTES = 50 * 1024 * 1024;

// Public/unauthenticated uploads (customer inquiry attachments) still go up
// as a base64 string inside a single server-fn POST body, which inflates
// the raw file size by ~1.37x (base64 + JSON overhead). Firebase App
// Hosting (Cloud Run) rejects request bodies over ~32MB with a bare 500 and
// no response body — confirmed by reproducing it directly against
// production with a 33MB file. 20MB raw stays safely under that (~27MB
// encoded) with room to spare; anything bigger should go through the
// "paste a link" flow instead of a doomed direct upload.
export const MAX_PUBLIC_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isOversizedFile(file: File, maxBytes: number): boolean {
  return file.size > maxBytes;
}

export function isValidExternalLink(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
