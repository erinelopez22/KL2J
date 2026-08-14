import { useRef, useState } from "react";
import { GripHorizontal, Star, X } from "lucide-react";
import { WriteReviewModal } from "@/components/WriteReviewModal";

export function DraggableReviewPrompt({ defaultName }: { defaultName: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  function onDragPointerDown(e: React.PointerEvent) {
    const rect = panelRef.current!.getBoundingClientRect();
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos?.x ?? rect.left,
      origY: pos?.y ?? rect.top,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragPointerMove(e: React.PointerEvent) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const rect = panelRef.current!.getBoundingClientRect();
    const nextX = drag.origX + (e.clientX - drag.startX);
    const nextY = drag.origY + (e.clientY - drag.startY);
    setPos({
      x: Math.min(Math.max(nextX, 0), window.innerWidth - rect.width),
      y: Math.min(Math.max(nextY, 0), window.innerHeight - rect.height),
    });
  }

  function onDragPointerUp() {
    dragState.current = null;
  }

  if (dismissed) return null;

  return (
    <>
      <div
        ref={panelRef}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        className={`fixed z-40 w-72 rounded-lg border border-border bg-card shadow-2xl ${
          pos ? "" : "bottom-6 right-6"
        }`}
      >
        <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-border bg-muted/40 px-2 py-1.5">
          <div
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
            className="flex flex-1 cursor-grab items-center py-1 pl-1 touch-none active:cursor-grabbing"
          >
            <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold">How was our service?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Rate KL2J and share your experience — it may be featured on our site once approved.
          </p>
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Star className="h-4 w-4" /> Write a review
          </button>
        </div>
      </div>
      {showReview && <WriteReviewModal onClose={() => setShowReview(false)} defaultName={defaultName} />}
    </>
  );
}
