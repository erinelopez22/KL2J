import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { sendPostBatch } from "@/lib/admin/posts.functions";

export type SendablePost = {
  id: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
};

export function SendProgress({
  post,
  retryFailed,
  onDone,
}: {
  post: SendablePost;
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
