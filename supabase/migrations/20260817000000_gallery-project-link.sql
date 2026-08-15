-- Link gallery folders to the project they were auto-created for, and mark
-- which gallery photos were auto-synced from a project's public attachments
-- (vs. uploaded directly by an admin) so sync can add/remove its own rows
-- without touching anything an admin dropped into the folder manually.

ALTER TABLE public.gallery_folders
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE;

ALTER TABLE public.gallery_photos
  ADD COLUMN origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'project'));
