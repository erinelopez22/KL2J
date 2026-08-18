-- Backs the admin notification bell's "new inquiry message" count — there's
-- no other way to tell an unread customer reply from one the admin has
-- already seen, unlike inquiries/reviews which already have a status field.
ALTER TABLE public.inquiry_comments
  ADD COLUMN is_read boolean NOT NULL DEFAULT false;
