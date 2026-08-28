// Server-only. Shared by src/routes/api/webhooks/brevo.ts (live events) and
// src/lib/admin/email-delivery-backfill.server.ts (catch-up for older
// sends) — both write a delivery_status onto post_recipients and need the
// same "recompute posts.bounced_count from what's actually in the table"
// step afterward, so a post's summary count can never drift from its
// recipients' real state.
import type { SupabaseClient } from "@supabase/supabase-js";

// Outcomes that mean the recipient did NOT get the email despite Brevo
// having accepted the send — what an admin actually cares about when a
// post's summary says "N sent." Excludes "deferred" (still might resolve)
// and "unsubscribed" (not a failure, just an opt-out).
const BOUNCE_LIKE_STATUSES = [
  "hard_bounce",
  "soft_bounce",
  "blocked",
  "invalid_email",
  "spam",
  "error",
];

export async function syncPostBouncedCount(
  supabaseAdmin: SupabaseClient,
  postId: string,
): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from("post_recipients")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .in("delivery_status", BOUNCE_LIKE_STATUSES);
  if (error) {
    console.error(`syncPostBouncedCount: failed to count for post ${postId}`, error.message);
    return;
  }
  await supabaseAdmin
    .from("posts")
    .update({ bounced_count: count ?? 0 })
    .eq("id", postId);
}
