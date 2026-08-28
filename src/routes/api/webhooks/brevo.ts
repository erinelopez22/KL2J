import { createFileRoute } from "@tanstack/react-router";
import { getRequestUrl } from "@tanstack/react-start/server";

// Brevo's webhook target — NOT reachable from the browser/admin UI. Brevo
// only lets you configure a destination URL (no custom headers on most
// plans), so authentication is a shared secret baked into that URL itself
// (see BREVO_WEBHOOK_SECRET / apphosting.yaml) rather than a header, unlike
// the cron worker's Authorization-header secret.
//
// This is what actually surfaces post-send delivery outcomes (bounced,
// blocked, opened, clicked, ...) in the admin Posts UI — until this
// existed, post_recipients only ever recorded whether the initial
// send-email API call succeeded, nothing about what happened after Brevo
// handed the message to the recipient's mail server. See the migration
// 20260828010000_post-recipients-delivery-status.sql for the columns this
// writes to, and src/routes/_authenticated/admin/posts.tsx for where
// they're displayed.
//
// Configure in Brevo: Transactional > Settings > Webhooks > add
// `https://kl2jlandsurveying.com/api/webhooks/brevo?secret=<BREVO_WEBHOOK_SECRET>`
// for at least: delivered, hard_bounce, soft_bounce, blocked, invalid_email,
// deferred, spam, error, opened, click, unsubscribed.

type BrevoWebhookEvent = {
  event?: string;
  email?: string;
  "message-id"?: string;
  messageId?: string;
  reason?: string;
  text?: string;
};

// Events after which we know the final delivery outcome (or something
// that overrides "sent" as far as an admin cares) — written to
// delivery_status/delivery_detail. Opens/clicks are handled separately
// below since they happen in addition to, not instead of, delivered.
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

async function applyEvent(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient,
  evt: BrevoWebhookEvent,
): Promise<void> {
  const eventName = evt.event?.toLowerCase();
  const messageId = evt["message-id"] ?? evt.messageId;
  if (!eventName || !messageId) return;

  const detail = evt.reason ?? evt.text ?? null;
  const now = new Date().toISOString();

  if (eventName === "opened" || eventName === "unique_opened") {
    await supabaseAdmin
      .from("post_recipients")
      .update({ opened_at: now, delivery_updated_at: now })
      .eq("brevo_message_id", messageId)
      .is("opened_at", null);
    return;
  }
  if (eventName === "click") {
    await supabaseAdmin
      .from("post_recipients")
      .update({ clicked_at: now, delivery_updated_at: now })
      .eq("brevo_message_id", messageId)
      .is("clicked_at", null);
    return;
  }
  if (DELIVERY_OUTCOME_EVENTS.has(eventName)) {
    await supabaseAdmin
      .from("post_recipients")
      .update({ delivery_status: eventName, delivery_detail: detail, delivery_updated_at: now })
      .eq("brevo_message_id", messageId);
  }
  // Any other event name (e.g. "request", Brevo's own "accepted for
  // sending" echo) is ignored — it's redundant with our own queue status.
}

export const Route = createFileRoute("/api/webhooks/brevo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.BREVO_WEBHOOK_SECRET;
        if (!secret) {
          console.error("brevo webhook: BREVO_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }
        const url = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
        if (url.searchParams.get("secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const events: BrevoWebhookEvent[] = Array.isArray(body)
          ? body
          : [body as BrevoWebhookEvent];

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          for (const evt of events) {
            await applyEvent(supabaseAdmin, evt);
          }
          return new Response("ok", { status: 200 });
        } catch (err) {
          // Log and still return 200 — Brevo retries on non-2xx, and a bug on
          // our end shouldn't cause Brevo to keep hammering this endpoint for
          // the same event indefinitely.
          console.error("brevo webhook: failed to apply event(s)", err);
          return new Response("logged", { status: 200 });
        }
      },
    },
  },
});
