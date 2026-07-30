-- Store email and phone as separate columns instead of one combined
-- "contact" field. "contact" is kept (still NOT NULL) for backward
-- compatibility with existing rows and code paths; new submissions keep
-- populating it too (derived from email/phone) so nothing that reads it
-- breaks.
ALTER TABLE public.inquiries
  ADD COLUMN email text,
  ADD COLUMN phone text;
