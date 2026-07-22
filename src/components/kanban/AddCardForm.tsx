import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createCard } from "@/lib/api/cards";
import { Plus, X } from "lucide-react";

export function AddCardForm({
  boardId,
  listId,
  nextPosition,
}: {
  boardId: string;
  listId: string;
  nextPosition: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const mut = useMutation({
    mutationFn: (t: string) => createCard({ boardId, listId, title: t, position: nextPosition }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      setTitle("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 rounded px-2 py-1.5 flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Add a card
      </button>
    );
  }

  function submit() {
    const t = title.trim();
    if (!t) return;
    mut.mutate(t);
  }

  return (
    <div>
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder="Enter a title for this card…"
        className="w-full text-sm rounded-md bg-card border border-input p-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!title.trim() || mut.isPending}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          Add card
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
          className="p-1.5 rounded hover:bg-black/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
