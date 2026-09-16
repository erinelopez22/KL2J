import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { sendNextRecipient } from "@/lib/admin/posts.functions";

export type SendablePost = {
  id: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
};

// Not required by Brevo's own limits — their infrastructure paces actual
// delivery independently of how fast we call their API — just a cheap,
// deliberate margin between our own send calls.
const SEND_PAUSE_MS = 300;
const RETRY_BACKOFF_MS = 2000;

// Drives the send itself: calls sendNextRecipient back-to-back (each call
// claims and sends exactly one due recipient) until nothing's left due for
// this post, showing real per-call progress instead of polling. Stops and
// hands off to the background cron (an infrequent catch-up net) once
// nothing more is due right now — which is the normal end state, or the
// rare case where the daily send cap pushed the rest to a later slot.
export function SendProgress({
  post,
  onStatusChange,
  onBusyChange,
}: {
  post: SendablePost;
  onStatusChange: (status: "sent" | "paused") => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [progress, setProgress] = useState({
    sent: post.sent_count,
    failed: post.failed_count,
    total: post.total_count,
  });
  const doSendNext = useServerFn(sendNextRecipient);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    onBusyChange?.(true);

    async function loop() {
      while (!cancelled) {
        let result: Awaited<ReturnType<typeof doSendNext>>;
        try {
          result = await doSendNext({ data: { id: post.id } });
        } catch {
          // A queued recipient row is untouched until successfully claimed,
          // so a network hiccup here is always safe to just retry.
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
          continue;
        }
        if (cancelled) return;
        if (!result.picked) {
          onBusyChange?.(false);
          return;
        }
        setProgress({
          sent: result.sentCount,
          failed: result.failedCount,
          total: post.total_count,
        });
        if (result.circuitBroken) {
          onBusyChange?.(false);
          onStatusChange("paused");
          return;
        }
        if (result.done) {
          onBusyChange?.(false);
          onStatusChange("sent");
          return;
        }
        await new Promise((r) => setTimeout(r, SEND_PAUSE_MS));
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

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
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending — please keep this open until it
        finishes
      </p>
    </div>
  );
}
