import { useState } from "react";
import { LinkIcon, X } from "lucide-react";
import { isValidExternalLink } from "@/lib/uploadLimits";

export function OversizeFileLinkPrompt({
  fileName,
  onSave,
  onCancel,
}: {
  fileName: string;
  onSave: (link: string) => void;
  onCancel: () => void;
}) {
  const [link, setLink] = useState("");

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-amber-900">
          <strong className="block">"{fileName}" is over 50MB.</strong>
          Upload it to Google Drive, OneDrive, or a similar service, then paste the shareable link below.
        </p>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="shrink-0 text-amber-700 hover:text-amber-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-700/70" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://drive.google.com/…"
            className="h-9 w-full rounded-md border border-amber-300 bg-white pl-8 pr-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={!isValidExternalLink(link)}
          onClick={() => onSave(link.trim())}
          className="shrink-0 rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Save link
        </button>
      </div>
    </div>
  );
}
