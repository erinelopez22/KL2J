-- Projects: replace published flag + single date with a status workflow,
-- a date range, and a personnel list.

-- Must drop first: this policy depends on the published column.
DROP POLICY IF EXISTS "Public can read published projects" ON public.projects;

ALTER TABLE public.projects
  DROP COLUMN published,
  DROP COLUMN project_date,
  ADD COLUMN status text NOT NULL DEFAULT 'Created'
    CHECK (status IN ('Created', 'Attended', 'On-hold', 'Completed', 'Cancelled')),
  ADD COLUMN start_date date,
  ADD COLUMN end_date date,
  ADD COLUMN personnel text[] NOT NULL DEFAULT '{}';

-- Only "Completed" projects are visible to the public site; service_role
-- (the admin backend) bypasses RLS entirely, so every status stays visible in /admin.
CREATE POLICY "Public can read completed projects" ON public.projects
  FOR SELECT TO anon, authenticated
  USING (status = 'Completed');
