import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { createList } from "@/lib/api/lists";

export function AddListForm({ boardId, nextPosition }: { boardId: string; nextPosition: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const mut = useMutation({
    mutationFn: (t: string) => createList({ boardId, title: t, position: nextPosition }),
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
        className="w-[272px] shrink-0 h-11 rounded-xl bg-white/25 hover:bg-white/35 text-white text-sm font-medium flex items-center justify-center gap-1 backdrop-blur"
      >
        <Plus className="h-4 w-4" /> Add another list
      </button>
    );
  }

  function submit() {
    const t = title.trim();
    if (!t) return;
    mut.mutate(t);
  }

  return (
    <div className="w-[272px] shrink-0 rounded-xl bg-list-surface p-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder="Enter list title…"
        className="w-full text-sm rounded-md bg-card border border-input px-2 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!title.trim() || mut.isPending}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          Add list
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
          className="p-1.5 rounded hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
