// Client-side only (uses browser Canvas/createImageBitmap APIs). Shrinks an
// image file before it gets base64-encoded and sent to a server function —
// phone camera photos are routinely 3-10MB at 4000px+ wide even though they
// only ever display as web thumbnails/cover images here, so resizing to a
// sane max dimension and re-encoding typically cuts file size by 70-90%
// with no visible quality loss. Non-image files (video, PDF, office docs)
// and anything that fails to process pass through unchanged.

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION = 1920;
const JPEG_WEBP_QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.round(bitmap.width * scale);
    const targetHeight = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    // PNG is lossless (no quality param) — its size only drops if we
    // resized; JPEG/WebP also benefit from a fresh, lower-quality encode
    // even at the same dimensions (phone cameras often save near 100%).
    const quality = file.type === "image/png" ? undefined : JPEG_WEBP_QUALITY;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, file.type, quality),
    );

    // Canvas re-encoding isn't guaranteed to win (e.g. an already-optimized
    // small PNG) — only use the result if it's actually smaller.
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: file.type });
  } catch {
    return file;
  }
}
