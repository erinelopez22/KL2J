import { useEffect, useRef, useState } from "react";

export type ImagePosition = { x: number; y: number; zoom: number };
export const DEFAULT_IMAGE_POSITION: ImagePosition = { x: 50, y: 50, zoom: 1 };

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Renders an image that always fully covers its (positioned, sized) parent,
 * with a pannable focal point and zoom — replaces the `object-fit: cover` +
 * `object-position` + `transform: scale()` combo, which silently loses all
 * pan range on whichever axis exactly fits the frame at zoom 1 (zoom just
 * magnifies the existing crop from center, it never reveals new edge
 * content). Here zoom and cover-fit are computed together in pixels, so
 * zooming in always creates real slack to pan in both directions.
 *
 * Must be placed inside a `position: relative/absolute` ancestor with a
 * definite size — this component fills it via `absolute inset-0`.
 */
export function CoverImage({
  src,
  alt,
  position = DEFAULT_IMAGE_POSITION,
  editable = false,
  onPositionChange,
  className = "",
}: {
  src: string;
  alt: string;
  position?: ImagePosition;
  editable?: boolean;
  onPositionChange?: (pos: ImagePosition) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startClientX: number;
    startClientY: number;
    maxOffsetX: number;
    maxOffsetY: number;
  } | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [src]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { x, y, zoom } = position;

  let renderStyle: React.CSSProperties = { display: "none" };
  let maxOffsetX = 0;
  let maxOffsetY = 0;
  if (natural && natural.w > 0 && natural.h > 0 && containerSize && containerSize.w > 0 && containerSize.h > 0) {
    const baseScale = Math.max(containerSize.w / natural.w, containerSize.h / natural.h);
    const scale = baseScale * zoom;
    const renderedW = natural.w * scale;
    const renderedH = natural.h * scale;
    maxOffsetX = Math.max(0, renderedW - containerSize.w);
    maxOffsetY = Math.max(0, renderedH - containerSize.h);
    renderStyle = {
      position: "absolute",
      left: -(x / 100) * maxOffsetX,
      top: -(y / 100) * maxOffsetY,
      width: renderedW,
      height: renderedH,
      maxWidth: "none",
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!editable || !onPositionChange) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: x,
      startY: y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      maxOffsetX,
      maxOffsetY,
    };
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current || !onPositionChange) return;
    const { startX, startY, startClientX, startClientY, maxOffsetX, maxOffsetY } = dragState.current;
    const dxPx = e.clientX - startClientX;
    const dyPx = e.clientY - startClientY;
    const newX = maxOffsetX > 0 ? clamp(startX - (dxPx / maxOffsetX) * 100, 0, 100) : startX;
    const newY = maxOffsetY > 0 ? clamp(startY - (dyPx / maxOffsetY) * 100, 0, 100) : startY;
    onPositionChange({ x: newX, y: newY, zoom });
  }
  function handlePointerUp() {
    dragState.current = null;
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${editable ? "cursor-move touch-none select-none" : ""} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        style={renderStyle}
      />
    </div>
  );
}
