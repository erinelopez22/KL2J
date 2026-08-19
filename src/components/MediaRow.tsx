import { useState } from "react";
import { Play } from "lucide-react";
import { CoverImage } from "@/components/CoverImage";

function MediaTile({
  m,
  altText,
  badge,
  className,
  onClick,
}: {
  m: { url: string; type: "image" | "video"; position?: { x: number; y: number; zoom: number } };
  altText: string;
  badge?: number;
  className: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {m.type === "video" ? (
        <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : m.position ? (
        <CoverImage src={m.url} alt={altText} position={m.position} />
      ) : (
        <img src={m.url} alt={altText} className="h-full w-full object-cover" />
      )}
      {m.type === "video" && !badge && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
            <Play className="h-3 w-3 fill-slate-900 text-slate-900" />
          </div>
        </div>
      )}
      {!!badge && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
          <span className="text-base font-semibold text-white">+{badge}</span>
        </div>
      )}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

// Collapsed: single row, up to maxVisible tiles, "+N" on the last one if
// there's more. Clicking "+N" expands into a scrollable grid (capped to
// ~3 rows tall) instead of jumping into the lightbox — only when the row is
// interactive (onItemClick provided).
export function MediaRow({
  media,
  altText,
  maxVisible = 4,
  heightClass = "h-20",
  onItemClick,
  expandedFillParent = false,
}: {
  media: { url: string; type: "image" | "video"; position?: { x: number; y: number; zoom: number } }[];
  altText: string;
  maxVisible?: number;
  heightClass?: string;
  onItemClick?: (index: number) => void;
  // By default the expanded (all-photos) grid caps itself at 480px with its
  // own scrollbar, since most call sites aren't inside a sized flex
  // ancestor. Pass this when the caller already wraps MediaRow in a
  // `min-h-0 flex-1` container that should own the scrolling instead —
  // otherwise you get two nested scrollbars fighting each other.
  expandedFillParent?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (media.length === 0) return null;
  const visibleMedia = media.slice(0, maxVisible);
  const hiddenCount = media.length - visibleMedia.length;

  if (expanded) {
    return (
      <div className={expandedFillParent ? "flex h-full min-h-0 flex-col" : ""}>
        <div
          className={`grid grid-cols-4 gap-1 overflow-y-auto pr-1 ${
            expandedFillParent ? "min-h-0 flex-1" : "max-h-[480px]"
          }`}
        >
          {media.map((m, i) => (
            <MediaTile
              key={i}
              m={m}
              altText={altText}
              className="relative aspect-square overflow-hidden rounded-lg bg-muted"
              onClick={onItemClick ? () => onItemClick(i) : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={`mt-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline ${
            expandedFillParent ? "shrink-0" : ""
          }`}
        >
          Show less
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full gap-1">
      {visibleMedia.map((m, i) => {
        const isLastVisible = i === visibleMedia.length - 1;
        const isOverflowTile = isLastVisible && hiddenCount > 0;
        return (
          <MediaTile
            key={i}
            m={m}
            altText={altText}
            badge={isOverflowTile ? hiddenCount : undefined}
            className={`relative ${heightClass} flex-1 overflow-hidden rounded-lg bg-muted`}
            onClick={
              isOverflowTile
                ? onItemClick
                  ? () => setExpanded(true)
                  : undefined
                : onItemClick
                  ? () => onItemClick(i)
                  : undefined
            }
          />
        );
      })}
    </div>
  );
}
