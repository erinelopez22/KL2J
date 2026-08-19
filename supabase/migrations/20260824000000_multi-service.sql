-- Projects and inquiries can now be tagged with multiple services. The old
-- singular `service` column stays in place (unused by app code going
-- forward) for safety, backfilled into the new array so existing rows don't
-- lose their service until re-saved.

ALTER TABLE public.inquiries ADD COLUMN services text[] NOT NULL DEFAULT '{}';
UPDATE public.inquiries SET services = ARRAY[service] WHERE service IS NOT NULL AND service <> '';

ALTER TABLE public.projects ADD COLUMN services text[] NOT NULL DEFAULT '{}';
UPDATE public.projects SET services = ARRAY[service] WHERE service IS NOT NULL AND service <> '';
