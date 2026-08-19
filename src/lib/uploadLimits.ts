// Uploads go up as a base64 string inside a single server-fn POST body,
// which inflates the raw file size by ~1.37x (base64 + JSON overhead).
// Firebase App Hosting (Cloud Run) rejects request bodies over ~32MB with a
// bare 500 and no response body — confirmed by reproducing it directly
// against production with a 33MB file. 20MB raw stays safely under that
// (~27MB encoded) with room to spare; anything bigger should go through the
// "paste a link" flow instead of a doomed direct upload.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isOversizedFile(file: File): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

export function isValidExternalLink(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
