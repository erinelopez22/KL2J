import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { uploadSiteMedia } from "@/lib/admin/media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";
import { isOversizedFile } from "@/lib/uploadLimits";

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
  const upload = useServerFn(uploadSiteMedia);

  async function handleFile(file: File) {
    if (isOversizedFile(file)) {
      toast.error(`"${file.name}" is over 50MB. Please choose a smaller image.`);
      return;
    }
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await upload({
        data: { folder, filename: file.name, contentType: file.type, base64 },
      });
      onUploaded(result.url);
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
