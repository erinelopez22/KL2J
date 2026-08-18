-- Admin-only categorization for filtering /admin/projects by scale — not
-- exposed on the public site.
ALTER TABLE public.projects
  ADD COLUMN size text NOT NULL DEFAULT 'small' CHECK (size IN ('major', 'small'));
