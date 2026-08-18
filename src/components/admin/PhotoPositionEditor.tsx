import { Slider } from "@/components/ui/slider";
import { CoverImage, type ImagePosition } from "@/components/CoverImage";

export function PhotoPositionEditor({
  imageUrl,
  position,
  onChange,
  heightClass = "h-48",
}: {
  imageUrl: string;
  position: ImagePosition;
  onChange: (pos: ImagePosition) => void;
  heightClass?: string;
}) {
  return (
    <div>
      <div className={`relative ${heightClass} w-full overflow-hidden rounded-lg border border-border bg-muted`}>
        <CoverImage
          src={imageUrl}
          alt="Reposition preview"
          position={position}
          editable
          onPositionChange={onChange}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground/70">
        Click or drag inside the preview to reposition the focal point.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="w-10 shrink-0 text-xs text-muted-foreground">Zoom</span>
        <Slider
          value={[position.zoom]}
          onValueChange={([zoom]) => onChange({ ...position, zoom })}
          min={1}
          max={3}
          step={0.05}
        />
      </div>
    </div>
  );
}
