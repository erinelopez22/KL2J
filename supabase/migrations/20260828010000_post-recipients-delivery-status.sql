-- Adds delivery-lifecycle tracking to post_recipients, fed by a new inbound
-- webhook (src/routes/api/webhooks/brevo.ts) that Brevo calls as events
-- happen after a send. Until now this table only ever recorded "did the
-- initial send-email API call succeed" (status sent/failed) — nothing about
-- what happened after Brevo handed the message to the recipient's mail
-- server (bounced, blocked, opened, clicked, etc.), because nothing was
-- listening for that.
--
-- `smtp_response` was already (mis)used to hold Brevo's messageId, not an
-- actual SMTP response string. `brevo_message_id` replaces it as the
-- correctly-named column the webhook uses to match an incoming event back
-- to the recipient row it belongs to; existing values are backfilled so
-- already-sent rows aren't orphaned. `smtp_response` is left in place
-- (unused going forward) rather than dropped, so old data isn't destroyed.
--
-- `delivery_status` holds Brevo's own event name verbatim (delivered,
-- hard_bounce, soft_bounce, blocked, invalid_email, deferred, spam,
-- unsubscribed, error, ...) rather than a CHECK-constrained enum, since
-- Brevo's event vocabulary isn't something we control and a rigid
-- constraint could reject a legitimate future event name outright.
-- `opened_at`/`clicked_at` are tracked separately from `delivery_status`
-- because those events happen in addition to (not instead of) a delivered
-- outcome.
ALTER TABLE public.post_recipients
  ADD COLUMN IF NOT EXISTS brevo_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_detail text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;

UPDATE public.post_recipients
  SET brevo_message_id = smtp_response
  WHERE brevo_message_id IS NULL AND smtp_response IS NOT NULL;

CREATE INDEX IF NOT EXISTS post_recipients_brevo_message_id_idx
  ON public.post_recipients (brevo_message_id)
  WHERE brevo_message_id IS NOT NULL;
