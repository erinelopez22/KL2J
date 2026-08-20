import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { createSiteMediaUploadUrl } from "@/lib/admin/media.functions";
import { uploadFileDirect } from "@/lib/adminDirectUpload";
import { compressImage } from "@/lib/compressImage";
import { isOversizedFile, MAX_ADMIN_UPLOAD_BYTES } from "@/lib/uploadLimits";

const MAX_UPLOAD_MB = Math.round(MAX_ADMIN_UPLOAD_BYTES / 1024 / 1024);

/** Compact hover-to-reveal "change photo" overlay, Facebook cover/profile-photo style. */
export function QuickImageUpload({
  folder,
  onUploaded,
  label,
  className = "",
  iconOnly = false,
}: {
  folder: "branding" | "projects";
  onUploaded: (url: string) => void;
  label: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mint = useServerFn(createSiteMediaUploadUrl);

  async function handleFile(rawFile: File) {
    setBusy(true);
    const file = await compressImage(rawFile);
    if (isOversizedFile(file, MAX_ADMIN_UPLOAD_BYTES)) {
      toast.error(`"${file.name}" is over ${MAX_UPLOAD_MB}MB. Please choose a smaller image.`);
      setBusy(false);
      return;
    }
    try {
      const result = await uploadFileDirect(mint, "site-media", file, { folder });
      onUploaded(result.url!);
      toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) inputRef.current?.click();
      }}
      disabled={busy}
      className={
        iconOnly
          ? `flex items-center justify-center rounded-full bg-black/70 p-2 text-white hover:bg-black/85 ${className}`
          : `flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-black/85 ${className}`
      }
      aria-label={label}
      title={label}
    >
      <Camera className="h-3.5 w-3.5" />
      {!iconOnly && <span>{busy ? "Uploading…" : label}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />
    </button>
  );
}
