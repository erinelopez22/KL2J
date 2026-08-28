-- Companion to bounced_count (20260828020000): the post summary shouldn't
-- headline "N sent" (Brevo API acceptance) when "N delivered" (confirmed
-- arrival) is the number an admin actually wants to see. Synced the same
-- way — recomputed from post_recipients, not incremented — by
-- syncPostDeliveryCounts in src/lib/posts-delivery-counts.server.ts.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS delivered_count int NOT NULL DEFAULT 0;
