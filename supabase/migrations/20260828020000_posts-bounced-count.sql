-- `sent_count` only ever meant "Brevo's API accepted this many sends" — an
-- admin reading "8/8 sent" reasonably reads that as "8 people got it,"
-- which isn't true once delivery status can tell us some of those bounced.
-- `bounced_count` tracks how many of the sent recipients are now known to
-- have failed after acceptance (hard_bounce, soft_bounce, blocked,
-- invalid_email, spam, error) — kept as a synced count rather than an
-- incrementing counter (same pattern as sent_count/failed_count in
-- src/lib/admin/email-queue-worker.server.ts) so it can't drift from what
-- post_recipients actually says, since a delivery_status can also arrive
-- well after the send itself (webhook) or get filled in much later
-- (src/lib/admin/email-delivery-backfill.server.ts).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS bounced_count int NOT NULL DEFAULT 0;
