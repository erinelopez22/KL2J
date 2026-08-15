-- Gallery folders: admins group photos/videos into named folders
-- (name, description, location, date range); ungrouped media stays
-- "unsorted" (folder_id IS NULL). Deleting a folder unassigns its
-- media rather than deleting it.

CREATE TABLE public.gallery_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text,
  date_start date,
  date_end date,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_folders ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gallery_folders TO anon, authenticated;
GRANT ALL ON public.gallery_folders TO service_role;
CREATE POLICY "Public can read gallery_folders" ON public.gallery_folders FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.gallery_photos
  ADD COLUMN folder_id uuid REFERENCES public.gallery_folders(id) ON DELETE SET NULL;
