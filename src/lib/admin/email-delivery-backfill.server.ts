// Server-only. One-time/on-demand catch-up for post_recipients rows whose
// message was sent before the /api/webhooks/brevo endpoint existed (or
// during the window it was misconfigured) — those sends genuinely happened
// and Brevo has a permanent record of what happened to them, but no
// webhook call was ever made for them, so delivery_status stayed null
// forever without something asking Brevo directly.
//
// Brevo exposes that same history via transactionalEmails.getEmailEventReport
// — note its event names use a different vocabulary than the live webhook
// (e.g. "hardBounces"/"clicks" here vs "hard_bounce"/"click" from the
// webhook), so results are normalized to the same canonical set the
// webhook writes before being applied, via normalizeBrevoEventName.

const EVENT_NAME_MAP: Record<string, string> = {
  delivered: "delivered",
  hardbounces: "hard_bounce",
  softbounces: "soft_bounce",
  bounces: "hard_bounce",
  blocked: "blocked",
  invalid: "invalid_email",
  deferred: "deferred",
  spam: "spam",
  error: "error",
  unsubscribed: "unsubscribed",
  opened: "opened",
  clicks: "click",
};

function normalizeBrevoEventName(raw: string): string | null {
  return EVENT_NAME_MAP[raw.toLowerCase()] ?? null;
}

const DELIVERY_OUTCOME_EVENTS = new Set([
  "delivered",
  "hard_bounce",
  "soft_bounce",
  "blocked",
  "invalid_email",
  "deferred",
  "spam",
  "error",
  "unsubscribed",
]);

type BrevoReportEvent = {
  date: string;
  event: string;
  messageId: string;
  reason?: string;
};

// Brevo's report endpoint is paginated and filters by a date window, not by
// arbitrary message IDs — so this fetches everything in the window once
// and matches it against our rows locally, rather than one API call per
// recipient (which would mean hundreds of calls for a single backfill).
async function fetchAllEvents(): Promise<Map<string, BrevoReportEvent[]>> {
  const { BrevoClient } = await import("@getbrevo/brevo");
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Email sender not configured (missing BREVO_API_KEY)");
  const brevo = new BrevoClient({ apiKey });

  const byMessageId = new Map<string, BrevoReportEvent[]>();
  const limit = 100;
  let offset = 0;
  for (let page = 0; page < 50; page++) {
    const result = await brevo.transactionalEmails.getEmailEventReport({ days: 90, limit, offset });
    const events = result.events ?? [];
    for (const evt of events) {
      const list = byMessageId.get(evt.messageId) ?? [];
      list.push({ date: evt.date, event: evt.event, messageId: evt.messageId, reason: evt.reason });
      byMessageId.set(evt.messageId, list);
    }
    if (events.length < limit) break;
    offset += limit;
  }
  return byMessageId;
}

export type BackfillResult = { checked: number; updated: number };

export async function backfillDeliveryStatuses(): Promise<BackfillResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("post_recipients")
    .select("id, post_id, brevo_message_id")
    .eq("status", "sent")
    .is("delivery_status", null)
    .not("brevo_message_id", "is", null);
  if (error) throw new Error(`Failed to load recipients to backfill: ${error.message}`);

  let updated = 0;
  if (rows && rows.length > 0) {
    const eventsByMessageId = await fetchAllEvents();

    for (const row of rows) {
      const messageId = row.brevo_message_id;
      if (!messageId) continue;
      const events = eventsByMessageId.get(messageId);
      if (!events || events.length === 0) continue;

      const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
      let outcomeStatus: string | null = null;
      let outcomeDetail: string | null = null;
      let openedAt: string | null = null;
      let clickedAt: string | null = null;

      for (const evt of sorted) {
        const canonical = normalizeBrevoEventName(evt.event);
        if (!canonical) continue;
        if (canonical === "opened" && !openedAt) openedAt = evt.date;
        else if (canonical === "click" && !clickedAt) clickedAt = evt.date;
        else if (DELIVERY_OUTCOME_EVENTS.has(canonical)) {
          outcomeStatus = canonical;
          outcomeDetail = evt.reason ?? outcomeDetail;
        }
      }

      if (!outcomeStatus && !openedAt && !clickedAt) continue;

      const { error: updateErr } = await supabaseAdmin
        .from("post_recipients")
        .update({
          ...(outcomeStatus
            ? { delivery_status: outcomeStatus, delivery_detail: outcomeDetail }
            : {}),
          ...(openedAt ? { opened_at: openedAt } : {}),
          ...(clickedAt ? { clicked_at: clickedAt } : {}),
          delivery_updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (!updateErr) updated++;
    }
  }

  // Always resync every post's bounced_count against what post_recipients
  // actually says now — not just posts touched by this run's loop above —
  // so a post whose bounces were already captured before bounced_count
  // existed (or by a previous backfill run) still gets its summary count
  // corrected the next time this is clicked.
  const { data: bouncedRows, error: bouncedErr } = await supabaseAdmin
    .from("post_recipients")
    .select("post_id")
    .in("delivery_status", [
      "hard_bounce",
      "soft_bounce",
      "blocked",
      "invalid_email",
      "spam",
      "error",
    ]);
  if (bouncedErr) {
    console.error(
      "backfillDeliveryStatuses: failed to load posts to resync counts for",
      bouncedErr.message,
    );
  } else {
    const { syncPostBouncedCount } = await import("@/lib/posts-delivery-counts.server");
    const postIds = new Set((bouncedRows ?? []).map((r) => r.post_id));
    for (const postId of postIds) {
      await syncPostBouncedCount(supabaseAdmin, postId);
    }
  }

  return { checked: rows?.length ?? 0, updated };
}
