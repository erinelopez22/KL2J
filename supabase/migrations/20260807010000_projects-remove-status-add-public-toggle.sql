-- Projects are reference/documentation for admins now, not a public-facing
-- status workflow. Drop the status column and the trigger that auto-synced
-- project status onto the linked inquiry (inquiry status is now set
-- manually via drag-and-drop on the admin Kanban board), and replace the
-- "Completed only" public-visibility gate with an explicit admin toggle.

DROP TRIGGER IF EXISTS trg_sync_inquiry_status ON public.projects;
DROP FUNCTION IF EXISTS public.sync_inquiry_status_from_project();

DROP POLICY IF EXISTS "Public can read completed projects" ON public.projects;

ALTER TABLE public.projects DROP COLUMN IF EXISTS status;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Public can read public projects" ON public.projects;
CREATE POLICY "Public can read public projects" ON public.projects
  FOR SELECT TO anon, authenticated
  USING (is_public = true);
