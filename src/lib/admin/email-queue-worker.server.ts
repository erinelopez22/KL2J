// Server-only. Invoked by the /api/cron/process-email-queue route, which is
// hit on a schedule by Cloud Scheduler — NOT by any browser client. Each
// invocation claims and sends exactly one due recipient, so throughput is
// governed entirely by how often the scheduler calls in (recommended: every
// 1 minute), not by anything in this file.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostType } from "@/lib/postCta";

const MAX_ATTEMPTS = 3;
const CIRCUIT_BREAKER_WINDOW = 5;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 2;
const CIRCUIT_BREAKER_ERROR_PATTERN = /blocked|rejected|spam|denied/i;

type ProcessResult =
  | { picked: false }
  | {
      picked: true;
      recipientId: string;
      email: string;
      outcome: "sent" | "failed";
      circuitBroken: boolean;
    };

export async function processNextQueuedEmail(): Promise<ProcessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Only rows belonging to a post that's actually mid-send are eligible —
  // a draft's recipients sit in this same table with status 'pending' but
  // must never be picked up. `posts!inner(status)` performs that join/filter
  // in the query itself rather than trusting a client-set flag.
  const nowIso = new Date().toISOString();
  const { data: candidates, error: findErr } = await supabaseAdmin
    .from("post_recipients")
    .select("id, post_id, email, name, attempts, posts!inner(status)")
    .eq("status", "pending")
    .eq("posts.status", "sending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(1);
  if (findErr) throw new Error(`Failed to load queue: ${findErr.message}`);
  const candidate = candidates?.[0];
  if (!candidate) return { picked: false };

  // Claim it — the `.eq("status", "pending")` guard means if two invocations
  // somehow overlap, only one successfully claims this row.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("post_recipients")
    .update({ status: "sending" })
    .eq("id", candidate.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimErr) throw new Error(`Failed to claim recipient: ${claimErr.message}`);
  if (!claimed) return { picked: false };

  const [{ data: post, error: postErr }, { data: siteSettings }] = await Promise.all([
    supabaseAdmin
      .from("posts")
      .select("id, type, title, subject, body_html, project_ids, attachments")
      .eq("id", candidate.post_id)
      .single(),
    supabaseAdmin
      .from("site_settings")
      .select("email_cover_photo_url, email_cover_photo_by_type, logo_url")
      .eq("id", 1)
      .single(),
  ]);
  if (postErr || !post) throw new Error("Post not found for queued recipient");

  const { sendPostToRecipient } = await import("@/lib/posts-mailer.server");
  const coverPhotoByType =
    (siteSettings?.email_cover_photo_by_type as Record<string, string>) ?? {};
  const postForEmail = {
    type: post.type as PostType,
    title: post.title,
    subject: post.subject,
    body_html: post.body_html,
    project_ids: post.project_ids,
    attachments: post.attachments as {
      url: string;
      name: string;
      contentType: string;
      kind: "image" | "video" | "document";
    }[],
    coverPhotoUrl: coverPhotoByType[post.type] ?? siteSettings?.email_cover_photo_url ?? null,
    logoUrl: siteSettings?.logo_url ?? null,
  };

  let outcome: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;
  const attemptedAt = new Date().toISOString();
  try {
    const { response } = await sendPostToRecipient(postForEmail, candidate);
    await supabaseAdmin
      .from("post_recipients")
      .update({
        status: "sent",
        brevo_message_id: response,
        sent_at: attemptedAt,
        attempted_at: attemptedAt,
      })
      .eq("id", candidate.id);
  } catch (e) {
    outcome = "failed";
    errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`process-email-queue: send failed for ${candidate.email}`, errorMessage);
    await supabaseAdmin
      .from("post_recipients")
      .update({
        status: "failed",
        error: errorMessage,
        attempts: candidate.attempts + 1,
        attempted_at: attemptedAt,
      })
      .eq("id", candidate.id);
  }

  await syncPostCounts(supabaseAdmin, candidate.post_id);

  const circuitBroken =
    outcome === "failed"
      ? await maybeTripCircuitBreaker(supabaseAdmin, candidate.post_id, errorMessage)
      : false;

  return {
    picked: true,
    recipientId: candidate.id,
    email: candidate.email,
    outcome,
    circuitBroken,
  };
}

async function syncPostCounts(supabaseAdmin: SupabaseClient, postId: string): Promise<void> {
  const [{ count: sentCount }, { count: failedCount }, { count: openCount }] = await Promise.all([
    supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("status", "sent"),
    supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("status", "failed"),
    supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .in("status", ["pending", "sending", "paused"]),
  ]);
  const done = (openCount ?? 0) === 0;
  await supabaseAdmin
    .from("posts")
    .update({
      sent_count: sentCount ?? 0,
      failed_count: failedCount ?? 0,
      ...(done ? { status: "sent", sent_at: new Date().toISOString() } : {}),
    })
    .eq("id", postId);
}

// Looks at this post's last CIRCUIT_BREAKER_WINDOW outcomes (sent or
// failed, most recently attempted first). If enough of them failed, or the
// error that just happened looks like a provider-side block, this pauses
// the rest of the batch for manual review instead of continuing to send
// into what's likely an active Gmail rejection.
async function maybeTripCircuitBreaker(
  supabaseAdmin: SupabaseClient,
  postId: string,
  lastError: string | null,
): Promise<boolean> {
  const { data: recent, error } = await supabaseAdmin
    .from("post_recipients")
    .select("status")
    .eq("post_id", postId)
    .in("status", ["sent", "failed"])
    .order("attempted_at", { ascending: false })
    .limit(CIRCUIT_BREAKER_WINDOW);
  if (error) {
    console.error("maybeTripCircuitBreaker: failed to load recent outcomes", error.message);
    return false;
  }

  const recentFailures = (recent ?? []).filter((r) => r.status === "failed").length;
  const errorLooksLikeABlock = !!lastError && CIRCUIT_BREAKER_ERROR_PATTERN.test(lastError);
  const shouldTrip = recentFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD || errorLooksLikeABlock;
  if (!shouldTrip) return false;

  console.error(
    `Circuit breaker tripped for post ${postId}: ${recentFailures}/${recent?.length ?? 0} recent sends failed` +
      (errorLooksLikeABlock ? ` (error matched block pattern: "${lastError}")` : ""),
  );

  await supabaseAdmin
    .from("post_recipients")
    .update({ status: "paused" })
    .eq("post_id", postId)
    .eq("status", "pending");
  await supabaseAdmin.from("posts").update({ status: "paused" }).eq("id", postId);

  return true;
}

export { MAX_ATTEMPTS };
