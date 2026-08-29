-- Lets an admin hide a gallery folder (and everything in it) from the
-- public site without deleting it — same is_public pattern already used
-- for projects (see 20260807010000_projects-remove-status-add-public-toggle.sql).
--
-- A folder linked to a project (project_id set) does NOT get its own
-- independent toggle: per product decision, its effective visibility
-- always mirrors that project's is_public instead, so a project and the
-- photos shown on its own detail page can never disagree about whether
-- they're public. gallery_folder_is_visible() is the single source of
-- truth for both this table's and gallery_photos' public SELECT policies
-- (SECURITY DEFINER so it can read projects.is_public regardless of the
-- calling user's own RLS access to that table).
ALTER TABLE public.gallery_folders
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.gallery_folder_is_visible(p_folder_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN f.project_id IS NOT NULL THEN COALESCE(p.is_public, false)
    ELSE f.is_public
  END
  FROM public.gallery_folders f
  LEFT JOIN public.projects p ON p.id = f.project_id
  WHERE f.id = p_folder_id;
$$;

DROP POLICY IF EXISTS "Public can read gallery_folders" ON public.gallery_folders;
CREATE POLICY "Public can read gallery_folders" ON public.gallery_folders
  FOR SELECT TO anon, authenticated
  USING (public.gallery_folder_is_visible(id));

-- Admin's own gallery page must still see hidden folders/photos to manage
-- them — additive policy (RLS policies for the same command OR together),
-- same pattern as 20260728030000_admin-can-read-all-projects.sql.
CREATE POLICY "Admins can read all gallery_folders" ON public.gallery_folders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Individual photos inherit their folder's visibility; unsorted photos
-- (folder_id IS NULL) are unaffected by any folder toggle.
DROP POLICY IF EXISTS "Public can read gallery_photos" ON public.gallery_photos;
CREATE POLICY "Public can read gallery_photos" ON public.gallery_photos
  FOR SELECT TO anon, authenticated
  USING (folder_id IS NULL OR public.gallery_folder_is_visible(folder_id));

CREATE POLICY "Admins can read all gallery_photos" ON public.gallery_photos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
