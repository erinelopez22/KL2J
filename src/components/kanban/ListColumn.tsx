import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateList } from "@/lib/api/lists";
import { CardTile, type CardRow } from "./CardTile";
import { AddCardForm } from "./AddCardForm";
import type { Tables } from "@/integrations/supabase/types";

export type ListRow = Tables<"lists">;

export function ListColumn({
  list,
  cards,
  boardId,
  onOpenCard,
}: {
  list: ListRow;
  cards: CardRow[];
  boardId: string;
  onOpenCard: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list", list },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);

  const renameMut = useMutation({
    mutationFn: (t: string) => updateList(list.id, { title: t }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const nextPos = (cards[cards.length - 1]?.position ?? 0) + 65536;
  const cardIds = cards.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-[272px] shrink-0 bg-list-surface rounded-xl p-2 flex flex-col max-h-[calc(100vh-8rem)]"
    >
      <div className="flex items-center gap-1 px-2 py-1" {...attributes} {...listeners}>
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (title.trim() && title !== list.title) renameMut.mutate(title.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitle(list.title);
                setEditing(false);
              }
            }}
            className="flex-1 text-sm font-semibold bg-card border border-input rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 text-left text-sm font-semibold px-2 py-1 truncate"
          >
            {list.title}
          </button>
        )}
        <span className="text-xs text-muted-foreground px-1">{cards.length}</span>
        <button className="p-1 rounded hover:bg-black/10" onPointerDown={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto kb-scrollbar px-1 py-1 space-y-2 min-h-[8px]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <CardTile key={c.id} card={c} onOpen={() => onOpenCard(c.id)} />
          ))}
        </SortableContext>
      </div>

      <div className="pt-1 px-1" onPointerDown={(e) => e.stopPropagation()}>
        <AddCardForm boardId={boardId} listId={list.id} nextPosition={nextPos} />
      </div>
    </div>
  );
}
