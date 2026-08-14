import { useEffect, useState } from "react";
import { FileText, ExternalLink, Loader2 } from "lucide-react";

export type LightboxItem = {
  name: string;
  kind: "image" | "video" | "document" | "external";
  resolveUrl: () => Promise<string> | string;
};

export function kindFromContentType(contentType: string, isExternalLink?: boolean): LightboxItem["kind"] {
  if (isExternalLink) return "external";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

export function AttachmentLightbox({
  items,
  startIndex,
  onClose,
}: {
  items: LightboxItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const item = items[index];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setUrl(null);
    Promise.resolve(item.resolveUrl())
      .then((u) => {
        if (!cancelled) {
          setUrl(u);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + items.length) % items.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);
  const isPdf = item.name.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4" onClick={onClose}>
      <button
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        ×
      </button>

      {items.length > 1 && (
        <button
          className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          aria-label="Previous"
        >
          ‹
        </button>
      )}

      <div className="flex max-h-[85vh] max-w-[90vw] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="flex h-64 w-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
          </div>
        )}
        {!loading && error && (
          <div className="flex h-64 w-64 flex-col items-center justify-center gap-2 rounded-lg bg-white/5 text-white/70">
            <FileText className="h-8 w-8" />
            <span className="text-sm">Failed to load file</span>
          </div>
        )}
        {!loading && !error && url && item.kind === "image" && (
          <img
            src={url}
            alt={item.name}
            className="max-h-[75vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        )}
        {!loading && !error && url && item.kind === "video" && (
          <video
            src={url}
            controls
            autoPlay
            className="max-h-[75vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        )}
        {!loading && !error && url && item.kind === "document" && isPdf && (
          <iframe src={url} title={item.name} className="h-[75vh] w-[80vw] rounded-lg bg-white shadow-2xl" />
        )}
        {!loading && !error && url && item.kind === "document" && !isPdf && (
          <div className="flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-lg bg-white/5 p-6 text-center text-white/80">
            <FileText className="h-8 w-8" />
            <span className="break-all text-sm">{item.name}</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              Open file <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
        {!loading && !error && url && item.kind === "external" && (
          <div className="flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-lg bg-white/5 p-6 text-center text-white/80">
            <ExternalLink className="h-8 w-8" />
            <span className="text-sm">This is an external link</span>
            <span className="break-all text-xs text-white/50">{item.name}</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              Open link <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
        <div className="max-w-[80vw] truncate text-sm text-white/70">{item.name}</div>
      </div>

      {items.length > 1 && (
        <button
          className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="Next"
        >
          ›
        </button>
      )}

      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
}
