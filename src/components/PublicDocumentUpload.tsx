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
  value: UploadedDocument[];
  onChange: (docs: UploadedDocument[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadInquiryDocument);

  async function handleFiles(files: FileList) {
    setBusy(true);
    try {
      const uploaded: UploadedDocument[] = [];
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const result = await upload({ data: { filename: file.name, contentType: file.type, base64 } });
        uploaded.push({ path: result.path, name: file.name, contentType: result.contentType });
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-1.5">
      {value.map((doc, i) => (
        <div
          key={doc.path}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{doc.name}</span>
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${doc.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div
        onClick={() => !busy && inputRef.current?.click()}
        className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="h-4 w-4" />
        {busy ? "Uploading…" : value.length > 0 ? "Add another file (optional)" : "Click to upload (optional)"}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          }}
        />
      </div>
    </div>
  );
}
