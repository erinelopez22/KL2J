import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Images } from "lucide-react";
import { uploadSiteMedia } from "@/lib/admin/media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";
import { isOversizedFile, MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";

const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load "${file.name}"`));
    img.src = objectUrl;
  });
}

/** Draws images side-by-side at a common height with a thin divider, exported as one JPEG. */
export async function mergeSideBySide(files: File[]): Promise<File> {
  const images = await Promise.all(files.map(loadImage));
  const commonHeight = Math.min(900, ...images.map((img) => img.naturalHeight));
  const dividerWidth = 6;
  const scaledWidths = images.map((img) => (img.naturalWidth / img.naturalHeight) * commonHeight);
  const totalWidth = scaledWidths.reduce((a, b) => a + b, 0) + dividerWidth * (images.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(totalWidth);
  canvas.height = Math.round(commonHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser");

  let x = 0;
  images.forEach((img, i) => {
    ctx.drawImage(img, x, 0, scaledWidths[i], commonHeight);
    x += scaledWidths[i];
    URL.revokeObjectURL(img.src);
    if (i < images.length - 1) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, 0, dividerWidth, commonHeight);
      x += dividerWidth;
    }
  });

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Failed to generate the combined image");
  return new File([blob], `combined-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export function CombinePhotoUpload({
  onUploaded,
}: {
  onUploaded: (result: { url: string; sourceFiles?: [File, File] }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadSiteMedia);

  async function handleFiles(fileList: FileList) {
    const all = Array.from(fileList);
    if (all.length > 2) {
      toast.info("Only the first 2 photos are used — extra selections were ignored.");
    }
    const files = all.slice(0, 2);
    const oversized = files.find(isOversizedFile);
    if (oversized) {
      toast.error(`"${oversized.name}" is over ${MAX_UPLOAD_MB}MB. Please choose smaller images.`);
      return;
    }
    setBusy(true);
    try {
      const finalFile = files.length === 2 ? await mergeSideBySide(files) : files[0];
      const base64 = await fileToBase64(finalFile);
      const result = await upload({
        data: { folder: "projects", filename: finalFile.name, contentType: finalFile.type, base64 },
      });
      onUploaded({
        url: result.url,
        sourceFiles: files.length === 2 ? [files[0], files[1]] : undefined,
      });
      toast.success(files.length === 2 ? "Photos combined and uploaded" : "Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-60"
      >
        <Images className="h-3.5 w-3.5" />
        {busy ? "Combining…" : "Combine two photos into one"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
        }}
      />
    </div>
  );
}
