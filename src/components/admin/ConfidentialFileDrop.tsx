import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { createConfidentialUploadUrl } from "@/lib/admin/media.functions";
import { uploadFileDirect } from "@/lib/adminDirectUpload";
import { compressImage } from "@/lib/compressImage";
import { isOversizedFile, MAX_ADMIN_UPLOAD_BYTES } from "@/lib/uploadLimits";
import { OversizeFileLinkPrompt } from "@/components/OversizeFileLinkPrompt";

const MAX_UPLOAD_MB = Math.round(MAX_ADMIN_UPLOAD_BYTES / 1024 / 1024);

export function ConfidentialFileDrop({
  accept = "image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime",
  label = "Click or drag a confidential file here",
  onUploaded,
}: {
  accept?: string;
  label?: string;
  onUploaded: (result: { path: string; contentType: string; name: string; isExternalLink?: boolean }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [oversizeQueue, setOversizeQueue] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const mint = useServerFn(createConfidentialUploadUrl);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    setBusy(true);
    const compressed = await Promise.all(list.map(compressImage));
    const okFiles: File[] = [];
    const oversized: File[] = [];
    for (const file of compressed) {
      (isOversizedFile(file, MAX_ADMIN_UPLOAD_BYTES) ? oversized : okFiles).push(file);
    }
    if (oversized.length > 0) setOversizeQueue((q) => [...q, ...oversized]);
    if (okFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      setBusy(false);
      return;
    }
    try {
      for (const file of okFiles) {
        const result = await uploadFileDirect(mint, "confidential-media", file);
        onUploaded({ path: result.path, contentType: result.contentType, name: file.name });
      }
      toast.success(okFiles.length > 1 ? `Uploaded ${okFiles.length} files (confidential)` : "Uploaded (confidential)");
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
          onUploaded({ path: link, contentType: file.type, name: file.name, isExternalLink: true });
          toast.success("Link saved");
          setOversizeQueue((q) => q.slice(1));
        }}
      />
    );
  }

  return (
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
        dragOver ? "border-amber-500 bg-amber-500/5" : "border-border hover:border-amber-500/50"
      } ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <Lock className="h-5 w-5 text-muted-foreground" />
      <span className="text-muted-foreground">{busy ? "Uploading…" : label}</span>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
        }}
      />
    </div>
  );
}
