import { useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

export function FloatingToolbar({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(16, window.innerWidth - 460) : 16,
    y: 88,
  }));
  const dragging = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const { startX, startY, origX, origY } = dragging.current;
    setPos({ x: origX + (e.clientX - startX), y: origY + (e.clientY - startY) });
  }
  function onPointerUp() {
    dragging.current = null;
  }

  return (
    <div
      className="fixed z-50 flex items-center gap-2 rounded-lg border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="cursor-move touch-none rounded p-1 text-muted-foreground hover:bg-muted"
        title="Drag to move"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      {children}
    </div>
  );
}
