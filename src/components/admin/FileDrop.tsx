import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { createSiteMediaUploadUrl } from "@/lib/admin/media.functions";
import { uploadFileDirect } from "@/lib/adminDirectUpload";
import { compressImage } from "@/lib/compressImage";
import { watermarkImage } from "@/lib/watermarkImage";
import { isOversizedFile, MAX_ADMIN_UPLOAD_BYTES } from "@/lib/uploadLimits";
import { OversizeFileLinkPrompt } from "@/components/OversizeFileLinkPrompt";

const MAX_UPLOAD_MB = Math.round(MAX_ADMIN_UPLOAD_BYTES / 1024 / 1024);

type Folder = "branding" | "gallery" | "documents" | "projects" | "companies" | "equipment";

export function FileDrop({
  folder,
  accept = "image/jpeg,image/png,image/webp",
  label = "Click or drag a file here",
  allowExternalLink = true,
  multiple = true,
  // Opt-in — only Gallery uploads and a project's Photos & videos tab pass
  // this, never project cover photos, logos, documents, confidential
  // files, or customer-submitted attachments (see watermarkImage.ts).
  allowWatermarkToggle = false,
  onUploaded,
}: {
  folder: Folder;
  accept?: string;
  label?: string;
  allowExternalLink?: boolean;
  multiple?: boolean;
  allowWatermarkToggle?: boolean;
  onUploaded: (result: {
    url: string;
    path?: string;
    contentType: string;
    name: string;
    isExternalLink?: boolean;
    watermarked?: boolean;
  }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [oversizeQueue, setOversizeQueue] = useState<File[]>([]);
  const [watermark, setWatermark] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const mint = useServerFn(createSiteMediaUploadUrl);

  async function handleFiles(files: FileList | File[]) {
    const list = multiple ? Array.from(files) : Array.from(files).slice(0, 1);
    setBusy(true);
    // Compress before the size check — a phone photo can start well over
    // the cap and still comfortably clear it once resized/re-encoded, so
    // checking pre-compression would reject files that would've been fine.
    // Watermarking (if opted into and checked) runs after compression, so
    // the mark is drawn at the final upload resolution instead of being
    // re-encoded/softened by a later resize.
    const compressed = await Promise.all(list.map(compressImage));
    const wasWatermarkApplied = allowWatermarkToggle && watermark;
    const processed = wasWatermarkApplied
      ? await Promise.all(compressed.map(watermarkImage))
      : compressed;
    const okFiles: File[] = [];
    const oversized: File[] = [];
    for (const file of processed) {
      (isOversizedFile(file, MAX_ADMIN_UPLOAD_BYTES) ? oversized : okFiles).push(file);
    }
    if (oversized.length > 0) {
      if (allowExternalLink) {
        setOversizeQueue((q) => [...q, ...oversized]);
      } else {
        toast.error(
          oversized.length === 1
            ? `"${oversized[0].name}" is over ${MAX_UPLOAD_MB}MB. Please choose a smaller file.`
            : `${oversized.length} files are over ${MAX_UPLOAD_MB}MB and were skipped.`,
        );
      }
    }
    if (okFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      setBusy(false);
      return;
    }
    try {
      for (const file of okFiles) {
        const result = await uploadFileDirect(mint, "site-media", file, { folder });
        onUploaded({
          url: result.url!,
          path: result.path,
          contentType: result.contentType,
          name: file.name,
          watermarked: wasWatermarkApplied,
        });
      }
      toast.success(okFiles.length > 1 ? `Uploaded ${okFiles.length} files` : "Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (oversizeQueue.length > 0) {
    return (
      <OversizeFileLinkPrompt
        fileName={oversizeQueue[0].name}
        maxMB={MAX_UPLOAD_MB}
        onCancel={() => setOversizeQueue((q) => q.slice(1))}
        onSave={(link) => {
          const file = oversizeQueue[0];
          onUploaded({ url: link, contentType: file.type, name: file.name, isExternalLink: true });
          toast.success("Link saved");
          setOversizeQueue((q) => q.slice(1));
        }}
      />
    );
  }

  return (
    <div>
      {allowWatermarkToggle && (
        <label className="mb-1.5 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={watermark}
            onChange={(e) => setWatermark(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border"
          />
          Add watermark ("KL2J Land Surveying and Engineering Services")
        </label>
      )}
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-muted-foreground">{busy ? "Uploading…" : label}</span>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          }}
        />
      </div>
    </div>
  );
}
