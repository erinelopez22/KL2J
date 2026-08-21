ALTER TABLE public.site_settings ADD COLUMN contact_phones text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.site_settings ADD COLUMN contact_email text;
ALTER TABLE public.site_settings ADD COLUMN service_area_text text;

UPDATE public.site_settings
SET contact_phones = ARRAY['0929 641 0776', '0995 460 8248'],
    contact_email = 'kl2j.engineering@gmail.com',
    service_area_text = 'Serving clients nationwide'
WHERE id = 1;
