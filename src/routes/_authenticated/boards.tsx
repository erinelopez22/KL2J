import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppBar } from "@/components/kanban/AppBar";
import { createBoard, listBoards } from "@/lib/api/boards";
import { BOARD_BACKGROUNDS, bgClass } from "@/lib/board-backgrounds";

export const Route = createFileRoute("/_authenticated/boards")({
  head: () => ({
    meta: [
      { title: "Your boards — KL2J Land Surveying and Engineering Services" },
      { name: "description", content: "All your kanban boards in one place." },
      { property: "og:title", content: "Your boards — KL2J Land Surveying and Engineering Services" },
      { property: "og:description", content: "All your kanban boards in one place." },
    ],
  }),
  component: BoardsHome,
});

function BoardsHome() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["boards"], queryFn: listBoards });
  const [creating, setCreating] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppBar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Your boards</h1>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data?.map((b) => (
              <Link
                key={b.id}
                to="/b/$boardId"
                params={{ boardId: b.id }}
                className="group relative overflow-hidden rounded-lg h-28 shadow-sm hover:shadow-md transition"
              >
                <div className={`absolute inset-0 ${bgClass(b.background)}`} />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition" />
                <div className="relative h-full p-3 flex flex-col justify-between text-white">
                  <div className="font-semibold text-sm truncate">{b.title}</div>
                  {b.starred && <Star className="h-4 w-4 fill-yellow-300 text-yellow-300 self-end" />}
                </div>
              </Link>
            ))}
            <button
              onClick={() => setCreating(true)}
              className="h-28 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition"
            >
              <Plus className="h-4 w-4 mr-2" /> Create new board
            </button>
          </div>
        )}
        {(!isLoading && data?.length === 0) && (
          <p className="mt-6 text-sm text-muted-foreground">No boards yet. Create your first one.</p>
        )}
      </main>
      {creating && <CreateBoardModal onClose={() => setCreating(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["boards"] })} />}
    </div>
  );
}

function CreateBoardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [bg, setBg] = useState<string>("blue");
  const mut = useMutation({
    mutationFn: () => createBoard({ title, background: bg }),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`rounded-lg h-24 mb-4 ${bgClass(bg)} shadow-inner`} />
        <h2 className="text-lg font-semibold mb-3">Create board</h2>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Board title</label>
        <input
          autoFocus
          className="w-full h-10 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-4"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Roadmap"
        />
        <label className="block text-xs font-medium text-muted-foreground mb-2">Background</label>
        <div className="grid grid-cols-6 gap-2 mb-6">
          {BOARD_BACKGROUNDS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBg(b.key)}
              className={`h-10 rounded-md ${b.className} ring-offset-2 ring-offset-card ${bg === b.key ? "ring-2 ring-primary" : ""}`}
              aria-label={b.label}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 h-9 rounded-md text-sm hover:bg-accent">Cancel</button>
          <button
            disabled={!title.trim() || mut.isPending}
            onClick={() => mut.mutate()}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {mut.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
