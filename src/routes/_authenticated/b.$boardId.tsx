import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { AppBar } from "@/components/kanban/AppBar";
import { ListColumn, type ListRow } from "@/components/kanban/ListColumn";
import { CardTile, CardDragPreview, type CardRow } from "@/components/kanban/CardTile";
import { AddListForm } from "@/components/kanban/AddListForm";
import { CardModal } from "@/components/kanban/CardModal";
import { getBoard, updateBoard } from "@/lib/api/boards";
import { getListsWithCards, updateList } from "@/lib/api/lists";
import { updateCard } from "@/lib/api/cards";
import { bgClass } from "@/lib/board-backgrounds";
import { z } from "zod";
import { Star } from "lucide-react";

const searchSchema = z.object({ card: z.string().optional() });

export const Route = createFileRoute("/_authenticated/b/$boardId")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Board — KL2J Land Surveying and Engineering Services" },
      { name: "description", content: "Drag and drop cards on your kanban board." },
    ],
  }),
  component: BoardView,
});

function BoardView() {
  const { boardId } = Route.useParams();
  const { card: openCardId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: board } = useQuery({ queryKey: ["board-info", boardId], queryFn: () => getBoard(boardId) });
  const { data, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => getListsWithCards(boardId),
  });

  const [activeCard, setActiveCard] = useState<CardRow | null>(null);
  const [activeList, setActiveList] = useState<ListRow | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const lists = data?.lists ?? [];
  const cardsByList = useMemo(() => {
    const map = new Map<string, CardRow[]>();
    for (const l of lists) map.set(l.id, []);
    for (const c of data?.cards ?? []) {
      if (!map.has(c.list_id)) map.set(c.list_id, []);
      map.get(c.list_id)!.push(c);
    }
    return map;
  }, [data, lists]);

  const listIds = lists.map((l) => l.id);
  const nextListPos = (lists[lists.length - 1]?.position ?? 0) + 65536;

  const renameBoardMut = useMutation({
    mutationFn: (title: string) => updateBoard(boardId, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-info", boardId] }),
  });
  const starMut = useMutation({
    mutationFn: (v: boolean) => updateBoard(boardId, { starred: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-info", boardId] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  function onDragStart(e: DragStartEvent) {
    const t = e.active.data.current;
    if (t?.type === "card") setActiveCard(t.card as CardRow);
    if (t?.type === "list") setActiveList(t.list as ListRow);
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveCard(null);
    setActiveList(null);
    if (!over || active.id === over.id) return;

    const aType = active.data.current?.type;
    const oType = over.data.current?.type;

    // List reorder
    if (aType === "list" && oType === "list") {
      const oldIndex = lists.findIndex((l) => l.id === active.id);
      const newIndex = lists.findIndex((l) => l.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(lists, oldIndex, newIndex);
      const before = reordered[newIndex - 1]?.position;
      const after = reordered[newIndex + 1]?.position;
      const newPos = computePos(before, after);
      qc.setQueryData(["board", boardId], (prev: typeof data) =>
        prev ? { ...prev, lists: reordered.map((l) => (l.id === active.id ? { ...l, position: newPos } : l)) } : prev,
      );
      try {
        await updateList(String(active.id), { position: newPos });
      } catch (err) {
        toast.error("Couldn't reorder list");
        qc.invalidateQueries({ queryKey: ["board", boardId] });
      }
      return;
    }

    // Card move
    if (aType === "card") {
      const activeCard = active.data.current?.card as CardRow;
      const overCard = over.data.current?.type === "card" ? (over.data.current.card as CardRow) : null;
      const overList = over.data.current?.type === "list" ? (over.data.current.list as ListRow) : null;
      const targetListId = overCard?.list_id ?? overList?.id;
      if (!targetListId) return;

      const targetCards = (cardsByList.get(targetListId) ?? []).filter((c) => c.id !== activeCard.id);
      let insertIndex = targetCards.length;
      if (overCard) {
        insertIndex = targetCards.findIndex((c) => c.id === overCard.id);
        if (insertIndex === -1) insertIndex = targetCards.length;
      }
      const before = targetCards[insertIndex - 1]?.position;
      const after = targetCards[insertIndex]?.position;
      const newPos = computePos(before, after);

      qc.setQueryData(["board", boardId], (prev: typeof data) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === activeCard.id ? { ...c, list_id: targetListId, position: newPos } : c,
          ),
        };
      });

      try {
        await updateCard(activeCard.id, { list_id: targetListId, position: newPos });
      } catch (err) {
        toast.error("Couldn't move card");
        qc.invalidateQueries({ queryKey: ["board", boardId] });
      }
    }
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgClass(board?.background)}`}>
      <AppBar transparent />

      {/* Board header */}
      <div className="h-14 flex items-center gap-3 px-4 bg-black/15 text-white backdrop-blur">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              if (titleDraft.trim() && titleDraft !== board?.title) renameBoardMut.mutate(titleDraft.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="text-lg font-bold bg-white/15 rounded px-2 py-1 outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setTitleDraft(board?.title ?? "");
              setEditingTitle(true);
            }}
            className="text-lg font-bold hover:bg-white/15 rounded px-2 py-1"
          >
            {board?.title ?? "Board"}
          </button>
        )}
        <button
          onClick={() => starMut.mutate(!board?.starred)}
          className="p-1.5 rounded hover:bg-white/15"
          aria-label="Star"
        >
          <Star className={`h-4 w-4 ${board?.starred ? "fill-yellow-300 text-yellow-300" : ""}`} />
        </button>
        <span className="text-xs bg-white/15 px-2 py-0.5 rounded">{board?.visibility ?? "private"}</span>
        <div className="flex-1" />
        <Link to="/inbox" className="text-sm hover:bg-white/15 px-2 py-1 rounded">Inbox</Link>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden kb-scrollbar">
        {isLoading ? (
          <div className="p-4 flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-[272px] h-40 rounded-xl bg-white/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-3 p-3 items-start h-full">
              <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
                {lists.map((l) => (
                  <ListColumn
                    key={l.id}
                    list={l}
                    cards={cardsByList.get(l.id) ?? []}
                    boardId={boardId}
                    onOpenCard={(id) => navigate({ to: ".", search: { card: id } })}
                  />
                ))}
              </SortableContext>
              <AddListForm boardId={boardId} nextPosition={nextListPos} />
            </div>
            <DragOverlay>
              {activeCard && <CardDragPreview card={activeCard} />}
              {activeList && (
                <div className="w-[272px] rounded-xl bg-list-surface p-2 shadow-xl rotate-2">
                  <div className="px-2 py-1 text-sm font-semibold">{activeList.title}</div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
        {!isLoading && lists.length === 0 && (
          <div className="p-8 text-white/90 text-sm">This board has no lists yet. Add your first list to get started.</div>
        )}
      </div>

      {openCardId && (
        <CardModal
          cardId={openCardId}
          boardId={boardId}
          listTitle={lists.find((l) => l.id === (data?.cards.find((c) => c.id === openCardId)?.list_id))?.title}
          onClose={() => navigate({ to: ".", search: {} })}
        />
      )}
    </div>
  );
}

function computePos(before?: number, after?: number): number {
  if (before == null && after == null) return 65536;
  if (before == null && after != null) return after / 2;
  if (before != null && after == null) return before + 65536;
  return ((before as number) + (after as number)) / 2;
}
