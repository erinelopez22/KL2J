-- Projects: add a location field (barangay/city/province).
ALTER TABLE public.projects ADD COLUMN location text NOT NULL DEFAULT '';
