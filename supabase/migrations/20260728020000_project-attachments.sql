-- Projects: replace the unused photo_urls text[] with a generic attachments
-- list that can hold photos, documents, and videos.

ALTER TABLE public.projects
  DROP COLUMN photo_urls,
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
