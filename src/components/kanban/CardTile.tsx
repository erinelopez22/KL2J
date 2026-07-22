import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, CheckSquare, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export type CardRow = Tables<"cards">;

export function CardTile({ card, onOpen }: { card: CardRow; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const hasDesc = !!card.description && card.description.trim().length > 0;
  const due = card.due_date ? new Date(card.due_date) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="bg-card rounded-lg shadow-sm hover:shadow-md cursor-pointer p-2.5 text-sm border border-transparent hover:border-border transition"
    >
      {card.cover_color && (
        <div className="h-2 rounded-md mb-2" style={{ background: card.cover_color }} />
      )}
      <div className="font-medium text-[13px] leading-snug text-foreground">{card.title}</div>
      {(hasDesc || due) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {due && (
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5">
              <Clock className="h-3 w-3" />
              {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
          {hasDesc && <AlignLeft className="h-3.5 w-3.5" />}
        </div>
      )}
    </div>
  );
}

export function CardDragPreview({ card }: { card: CardRow }) {
  return (
    <div className="bg-card rounded-lg shadow-lg p-2.5 text-sm rotate-3 w-64">
      <div className="font-medium text-[13px]">{card.title}</div>
    </div>
  );
}
