-- Photo/video attachments for admin Posts (Facebook-style "Add to your post"),
-- rendered inline (images) or as a "watch" link (video) in the outbound email.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';
