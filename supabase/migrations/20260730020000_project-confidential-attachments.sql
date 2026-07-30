-- Confidential project files: stored in a PRIVATE storage bucket (not the
-- public "site-media" one), never selected by the public projects query,
-- and only ever accessed by admins via short-lived signed URLs generated
-- on demand. This is real access control, not just "not linked publicly".
ALTER TABLE public.projects
  ADD COLUMN confidential_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('confidential-media', 'confidential-media', false)
ON CONFLICT (id) DO NOTHING;

-- No SELECT policy is added on purpose: the bucket is private, so
-- anon/authenticated get nothing by default. Only the service_role key
-- (used exclusively by admin-role-checked server functions) can read,
-- write, or generate signed URLs for objects in this bucket.
