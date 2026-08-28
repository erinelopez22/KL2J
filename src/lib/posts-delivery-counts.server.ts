// Server-only. Shared by src/routes/api/webhooks/brevo.ts (live events) and
// src/lib/admin/email-delivery-backfill.server.ts (catch-up for older
// sends) — both write a delivery_status onto post_recipients and need the
// same "recompute posts.delivered_count/bounced_count from what's actually
// in the table" step afterward, so a post's summary counts can never drift
// from its recipients' real state.
import type { SupabaseClient } from "@supabase/supabase-js";

// Outcomes that mean the recipient did NOT get the email despite Brevo
// having accepted the send — what an admin actually cares about when a
// post's summary says "N delivered." Excludes "deferred" (still might
// resolve) and "unsubscribed" (not a failure, just an opt-out).
const BOUNCE_LIKE_STATUSES = [
  "hard_bounce",
  "soft_bounce",
  "blocked",
  "invalid_email",
  "spam",
  "error",
];

export async function syncPostDeliveryCounts(
  supabaseAdmin: SupabaseClient,
  postId: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("post_recipients")
    .select("delivery_status")
    .eq("post_id", postId)
    .not("delivery_status", "is", null);
  if (error) {
    console.error(
      `syncPostDeliveryCounts: failed to load statuses for post ${postId}`,
      error.message,
    );
    return;
  }

  let delivered = 0;
  let bounced = 0;
  for (const row of data ?? []) {
    if (row.delivery_status === "delivered") delivered++;
    else if (row.delivery_status && BOUNCE_LIKE_STATUSES.includes(row.delivery_status)) bounced++;
  }

  await supabaseAdmin
    .from("posts")
    .update({ delivered_count: delivered, bounced_count: bounced })
    .eq("id", postId);
}
