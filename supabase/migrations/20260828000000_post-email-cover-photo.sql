ALTER TABLE public.site_settings ADD COLUMN email_cover_photo_url text;
ALTER TABLE public.site_settings ADD COLUMN email_cover_photo_by_type jsonb NOT NULL DEFAULT '{}'::jsonb;
