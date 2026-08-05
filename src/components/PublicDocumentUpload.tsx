import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { uploadInquiryDocument } from "@/lib/public-media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";

export type UploadedDocument = { path: string; name: string; contentType: string };

export function PublicDocumentUpload({
  value,
  onChange,
}: {
  value: UploadedDocument | null;
  onChange: (doc: UploadedDocument | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadInquiryDocument);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await upload({ data: { filename: file.name, contentType: file.type, base64 } });
      onChange({ path: result.path, name: file.name, contentType: result.contentType });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => !busy && inputRef.current?.click()}
      className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <Upload className="h-4 w-4" />
      {busy ? "Uploading…" : "Click to upload (optional)"}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
