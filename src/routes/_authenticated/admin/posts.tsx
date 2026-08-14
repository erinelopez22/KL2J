import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Plus, Pencil, Trash2, Send, RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deletePost, sendPostBatch } from "@/lib/admin/posts.functions";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { PostEditor, type PostRecord, type PostType } from "@/components/admin/PostEditor";

export const Route = createFileRoute("/_authenticated/admin/posts")({
  component: AdminPosts,
});

type PostRow = PostRecord & {
  status: "draft" | "sending" | "sent";
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

const TYPE_LABELS: Record<PostType, string> = {
  project: "Project",
  service: "Service",
  profile: "Company profile",
  update: "Update",
};

const STATUS_STYLES: Record<PostRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
};

function SendProgress({
  post,
  retryFailed,
  onDone,
}: {
  post: PostRow;
  retryFailed: boolean;
  onDone: () => void;
}) {
  const doSendBatch = useServerFn(sendPostBatch);
  const [sending, setSending] = useState(false);
  const [erroredOut, setErroredOut] = useState(false);
  const [progress, setProgress] = useState({
    sent: post.sent_count,
    failed: retryFailed ? 0 : post.failed_count,
    total: post.total_count,
  });
  const startedRef = useRef(false);

  async function run(isRetryFailed: boolean) {
    setSending(true);
    setErroredOut(false);
    let first = true;
    try {
      for (;;) {
        const result = await doSendBatch({
          data: { id: post.id, retryFailed: first && isRetryFailed },
        });
        first = false;
        setProgress((p) => ({
          sent: p.sent + result.sentThisBatch,
          failed: post.total_count - result.remainingPending - (p.sent + result.sentThisBatch),
          total: p.total,
        }));
        if (result.done) break;
      }
      toast.success("Send complete");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sending stopped due to an error");
      setErroredOut(true);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run(retryFailed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct =
    progress.total > 0
      ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
      : 100;

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {progress.sent} sent, {progress.failed} failed of {progress.total}
      </p>
      {sending && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…
        </p>
      )}
      {!sending && erroredOut && (
        <button
          type="button"
          onClick={() => run(false)}
          className="mt-2 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Send className="h-3.5 w-3.5" /> Resume sending
        </button>
      )}
    </div>
  );
}

function AdminPosts() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const doDelete = useServerFn(deletePost);
  const [filter, setFilter] = useState<"all" | PostRow["status"]>("all");
  const [editing, setEditing] = useState<PostRow | "new" | null>(null);
  const [activeSend, setActiveSend] = useState<{ id: string; retryFailed: boolean } | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PostRow[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
  }

  async function remove(post: PostRow) {
    const message =
      post.status === "draft"
        ? "Delete this draft post?"
        : `Delete this post? It was already sent to ${post.sent_count} recipient(s) — this only removes it from the admin list, it does not unsend the email.`;
    if (!(await confirm(message, { destructive: true }))) return;
    try {
      await doDelete({ data: { id: post.id } });
      toast.success("Post deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function startSend(post: PostRow) {
    if (post.total_count === 0) {
      toast.error("This post has no recipients — edit it and choose who to send to first.");
      return;
    }
    if (!(await confirm(`Send this post to ${post.total_count} recipient(s)?`))) return;
    setActiveSend({ id: post.id, retryFailed: false });
  }

  function startRetryFailed(post: PostRow) {
    setActiveSend({ id: post.id, retryFailed: true });
  }

  const all = posts ?? [];
  const counts = {
    all: all.length,
    draft: all.filter((p) => p.status === "draft").length,
    sending: all.filter((p) => p.status === "sending").length,
    sent: all.filter((p) => p.status === "sent").length,
  };
  const filtered = filter === "all" ? all : all.filter((p) => p.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="h-6 w-6 text-primary" /> Posts
          </h1>
          <p className="text-sm text-muted-foreground">
            Announce new projects, services, or company updates by email to your customers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "draft", "sending", "sent"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
              filter === f
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No {filter === "all" ? "" : filter} posts.
        </div>
      )}

      <div className="mt-6 space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase text-primary">
                    {TYPE_LABELS[p.type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[p.status]}`}
                  >
                    {p.status}
                  </span>
                  <span className="font-medium">{p.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.sent_count}/{p.total_count} sent
                  {p.failed_count > 0 ? `, ${p.failed_count} failed` : ""} ·{" "}
                  {new Date(p.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {p.status === "draft" && (
                  <>
                    <button
                      onClick={() => setEditing(p)}
                      className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => startSend(p)}
                      className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <Send className="h-3.5 w-3.5" /> Send
                    </button>
                  </>
                )}
                {p.status === "sending" && activeSend?.id !== p.id && (
                  <button
                    onClick={() => setActiveSend({ id: p.id, retryFailed: false })}
                    className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <Send className="h-3.5 w-3.5" /> Continue sending
                  </button>
                )}
                {p.status === "sent" && p.failed_count > 0 && activeSend?.id !== p.id && (
                  <button
                    onClick={() => startRetryFailed(p)}
                    className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Resend failed
                  </button>
                )}
                <button
                  onClick={() => remove(p)}
                  className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
            {activeSend?.id === p.id && (
              <SendProgress
                post={p}
                retryFailed={activeSend.retryFailed}
                onDone={() => {
                  setActiveSend(null);
                  refresh();
                }}
              />
            )}
          </div>
        ))}
      </div>

      {editing && (
        <PostEditor
          post={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
