import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { uploadSiteMedia } from "@/lib/admin/media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";
import { isOversizedFile } from "@/lib/uploadLimits";
import { OversizeFileLinkPrompt } from "@/components/OversizeFileLinkPrompt";

type Folder = "branding" | "gallery" | "documents" | "projects" | "companies";

export function FileDrop({
  folder,
  accept = "image/jpeg,image/png,image/webp",
  label = "Click or drag a file here",
  allowExternalLink = true,
  multiple = true,
  onUploaded,
}: {
  folder: Folder;
  accept?: string;
  label?: string;
  allowExternalLink?: boolean;
  multiple?: boolean;
  onUploaded: (result: { url: string; path?: string; contentType: string; name: string; isExternalLink?: boolean }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [oversizeQueue, setOversizeQueue] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadSiteMedia);

  async function handleFiles(files: FileList | File[]) {
    const list = multiple ? Array.from(files) : Array.from(files).slice(0, 1);
    const okFiles: File[] = [];
    const oversized: File[] = [];
    for (const file of list) {
      (isOversizedFile(file) ? oversized : okFiles).push(file);
    }
    if (oversized.length > 0) {
      if (allowExternalLink) {
        setOversizeQueue((q) => [...q, ...oversized]);
      } else {
        toast.error(
          oversized.length === 1
            ? `"${oversized[0].name}" is over 50MB. Please choose a smaller file.`
            : `${oversized.length} files are over 50MB and were skipped.`,
        );
      }
    }
    if (okFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      for (const file of okFiles) {
        const base64 = await fileToBase64(file);
        const result = await upload({
          data: { folder, filename: file.name, contentType: file.type, base64 },
        });
        onUploaded({ ...result, name: file.name });
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
  );
}
