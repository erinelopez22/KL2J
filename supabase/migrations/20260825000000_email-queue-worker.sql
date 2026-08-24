-- Turns post_recipients from a passive send-history log into a scheduled,
-- throttled send queue driven by a cron-triggered background worker instead
-- of a synchronous loop in the request handler.
--
-- New columns:
--   attempts      - retry count, capped at 3 across all time (see
--                   src/lib/admin/posts.functions.ts retryFailedRecipients).
--   smtp_response - the raw SMTP response text for a sent row, so an
--                   accepted-but-flagged send is visible to the admin.
--   scheduled_at  - when this row becomes eligible to send. Set at
--                   send-time (not save-time) to spread a batch across the
--                   daily rate cap; the worker picks the oldest eligible
--                   pending row.
--   attempted_at  - when this row was last actually sent/failed (unlike
--                   sent_at, set on failure too) — the circuit breaker orders
--                   by this to look at "the last N outcomes" for a post.
--
-- New statuses:
--   sending - claimed by a worker invocation, mid-send.
--   paused  - the circuit breaker tripped for this post; held for manual
--             review/resume rather than continuing to hammer Gmail.

ALTER TABLE public.post_recipients
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smtp_response text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz;

ALTER TABLE public.post_recipients DROP CONSTRAINT IF EXISTS post_recipients_status_check;
ALTER TABLE public.post_recipients ADD CONSTRAINT post_recipients_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'paused'));

CREATE INDEX IF NOT EXISTS post_recipients_scheduled_idx
  ON public.post_recipients (status, scheduled_at);

-- posts.status needs 'paused' too, so the admin list/badges can reflect a
-- circuit-broken batch instead of showing it as still "sending" forever.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'sending', 'sent', 'paused'));
