import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlignLeft, CheckSquare, MessageSquare, X } from "lucide-react";
import {
  addChecklistItem,
  addComment,
  deleteChecklistItem,
  getCard,
  getChecklistItems,
  getComments,
  toggleChecklistItem,
  updateCard,
} from "@/lib/api/cards";
import type { Tables } from "@/integrations/supabase/types";

export function CardModal({
  cardId,
  onClose,
  listTitle,
  boardId,
}: {
  cardId: string;
  onClose: () => void;
  listTitle?: string;
  boardId: string;
}) {
  const qc = useQueryClient();
  const { data: card } = useQuery({ queryKey: ["card", cardId], queryFn: () => getCard(cardId) });
  const { data: items = [] } = useQuery({ queryKey: ["checklist", cardId], queryFn: () => getChecklistItems(cardId) });
  const { data: comments = [] } = useQuery({ queryKey: ["comments", cardId], queryFn: () => getComments(cardId) });

  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description ?? "");
    }
  }, [card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const invalidateBoard = () => qc.invalidateQueries({ queryKey: ["board", boardId] });

  const saveTitle = useMutation({
    mutationFn: (t: string) => updateCard(cardId, { title: t }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["card", cardId] });
      invalidateBoard();
    },
  });
  const saveDesc = useMutation({
    mutationFn: (d: string) => updateCard(cardId, { description: d || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["card", cardId] }),
  });
  const addItem = useMutation({
    mutationFn: () =>
      addChecklistItem(cardId, newItem.trim(), (items[items.length - 1]?.position ?? 0) + 65536),
    onSuccess: () => {
      setNewItem("");
      qc.invalidateQueries({ queryKey: ["checklist", cardId] });
    },
  });
  const toggleItem = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggleChecklistItem(v.id, v.done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", cardId] }),
  });
  const delItem = useMutation({
    mutationFn: (id: string) => deleteChecklistItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", cardId] }),
  });
  const postComment = useMutation({
    mutationFn: () => addComment(cardId, newComment.trim()),
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["comments", cardId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const doneCount = items.filter((i) => i.is_done).length;
  const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-card rounded-xl shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-3 top-3 p-1.5 rounded hover:bg-accent" aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        {!card ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-6">
            <div className="min-w-0">
              {editingTitle ? (
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => {
                    setEditingTitle(false);
                    if (title.trim() && title !== card.title) saveTitle.mutate(title.trim());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      setTitle(card.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="w-full text-lg font-semibold border border-input rounded px-2 py-1"
                />
              ) : (
                <h2 className="text-lg font-semibold cursor-pointer" onClick={() => setEditingTitle(true)}>
                  {card.title}
                </h2>
              )}
              {listTitle && <p className="text-xs text-muted-foreground mt-0.5">in list {listTitle}</p>}

              <section className="mt-6">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <AlignLeft className="h-4 w-4" /> Description
                </h3>
                {editingDesc ? (
                  <div>
                    <textarea
                      rows={5}
                      autoFocus
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-sm rounded-md border border-input p-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          saveDesc.mutate(description);
                          setEditingDesc(false);
                        }}
                        className="h-8 px-3 rounded bg-primary text-primary-foreground text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setDescription(card.description ?? "");
                          setEditingDesc(false);
                        }}
                        className="h-8 px-3 rounded hover:bg-accent text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="w-full text-left text-sm bg-secondary hover:bg-accent rounded-md p-3 min-h-[48px] whitespace-pre-wrap"
                  >
                    {card.description || <span className="text-muted-foreground">Add a more detailed description…</span>}
                  </button>
                )}
              </section>

              <section className="mt-6">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <CheckSquare className="h-4 w-4" /> Checklist
                </h3>
                {items.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-10">{progress}%</span>
                  </div>
                )}
                <ul className="space-y-1">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={it.is_done}
                        onChange={(e) => toggleItem.mutate({ id: it.id, done: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className={`text-sm flex-1 ${it.is_done ? "line-through text-muted-foreground" : ""}`}>
                        {it.content}
                      </span>
                      <button
                        onClick={() => delItem.mutate(it.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Add an item"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newItem.trim()) addItem.mutate();
                    }}
                    className="flex-1 h-8 px-2 text-sm rounded border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => newItem.trim() && addItem.mutate()}
                    className="h-8 px-3 rounded bg-primary text-primary-foreground text-sm"
                  >
                    Add
                  </button>
                </div>
              </section>

              <section className="mt-6">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4" /> Activity
                </h3>
                <textarea
                  rows={2}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment…"
                  className="w-full text-sm rounded-md border border-input p-2 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-2">
                  <button
                    disabled={!newComment.trim() || postComment.isPending}
                    onClick={() => postComment.mutate()}
                    className="h-8 px-3 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                <ul className="mt-4 space-y-3">
                  {comments.map((c) => {
                    const p = (c as unknown as { profiles?: Tables<"profiles"> }).profiles;
                    const name = p?.full_name || p?.email || "User";
                    return (
                      <li key={c.id} className="flex gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs">
                            <span className="font-semibold">{name}</span>{" "}
                            <span className="text-muted-foreground">
                              {new Date(c.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm bg-secondary rounded-md p-2 mt-1 whitespace-pre-wrap">{c.body}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            <aside className="space-y-2 text-sm">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add to card</div>
              {["Members", "Labels", "Due date", "Cover"].map((l) => (
                <button key={l} className="w-full text-left px-3 py-1.5 bg-secondary hover:bg-accent rounded text-sm">
                  {l}
                </button>
              ))}
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3">Actions</div>
              <button
                onClick={async () => {
                  await updateCard(cardId, { archived: true });
                  invalidateBoard();
                  onClose();
                }}
                className="w-full text-left px-3 py-1.5 bg-secondary hover:bg-accent rounded text-sm"
              >
                Archive
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
