import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type SendablePost = {
  id: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
};

const POLL_INTERVAL_MS = 4000;

// Sending happens in the background (a cron worker processing roughly one
// recipient a minute, not this browser tab), so this component only polls
// and displays progress — it never sends anything itself. It stops polling
// once the post lands on 'sent' or 'paused' and hands that back to the
// parent via onStatusChange.
export function SendProgress({
  post,
  onStatusChange,
}: {
  post: SendablePost;
  onStatusChange: (status: "sent" | "paused") => void;
}) {
  const [progress, setProgress] = useState({
    sent: post.sent_count,
    failed: post.failed_count,
    total: post.total_count,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const { data, error } = await supabase
        .from("posts")
        .select("status, sent_count, failed_count, total_count")
        .eq("id", post.id)
        .single();
      if (cancelled || error || !data) return;
      setProgress({ sent: data.sent_count, failed: data.failed_count, total: data.total_count });
      if (data.status === "sent" || data.status === "paused") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onStatusChange(data.status);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
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
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending in the background — about one a
        minute, no need to keep this open
      </p>
    </div>
  );
}
