// Client-side only (Canvas API), same approach as compressImage.ts — draws
// a repeating diagonal text watermark onto an image before it's uploaded.
// Deliberately NOT baked into compressImage itself: that utility runs on
// nearly every image upload in the app (logos, confidential files,
// customer-submitted inquiry attachments, ...), and a watermark should
// only ever apply where an admin explicitly opts in for a specific upload
// (see FileDrop's `allowWatermarkToggle`) — it's the caller's job to only
// invoke this when that checkbox is checked.

const WATERMARK_TEXT = "KL2J Land Surveying and Engineering Services";

export async function watermarkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // Diagonal repeating pattern (like a stock-photo watermark) rather than
    // a single corner mark — a corner mark is trivial to crop out, a
    // full-image tile isn't. White text with a dark outline stays legible
    // against both light and dark photo backgrounds.
    const fontSize = Math.max(16, Math.round(canvas.width / 26));
    ctx.font = `600 ${fontSize}px system-ui, Arial, sans-serif`;
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(WATERMARK_TEXT).width;
    const stepX = textWidth + fontSize * 5;
    const stepY = fontSize * 7;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6); // -30deg
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = Math.max(1, fontSize / 12);
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#ffffff";

    // Oversized diagonal sweep so the rotated tile still fully covers every
    // corner of the canvas, not just its center.
    const span = canvas.width + canvas.height;
    for (let y = -span; y < span; y += stepY) {
      for (let x = -span; x < span; x += stepX) {
        ctx.strokeText(WATERMARK_TEXT, x, y);
        ctx.fillText(WATERMARK_TEXT, x, y);
      }
    }
    ctx.restore();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.9),
    );
    if (!blob) return file;
    return new File([blob], file.name, { type: blob.type });
  } catch {
    return file;
  }
}
