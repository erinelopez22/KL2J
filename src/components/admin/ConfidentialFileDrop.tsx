import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { uploadConfidentialMedia } from "@/lib/admin/media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";

export function ConfidentialFileDrop({
  accept = "image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime",
  label = "Click or drag a confidential file here",
  onUploaded,
}: {
  accept?: string;
  label?: string;
  onUploaded: (result: { path: string; contentType: string; name: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadConfidentialMedia);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await upload({ data: { filename: file.name, contentType: file.type, base64 } });
      onUploaded({ ...result, name: file.name });
      toast.success("Uploaded (confidential)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
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
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
