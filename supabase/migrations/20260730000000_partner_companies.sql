-- Tied-up / partner companies shown at the bottom of the public site,
-- managed via /admin/companies.
CREATE TABLE public.partner_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  storage_path text,
  website_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_companies ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.partner_companies TO anon, authenticated;
GRANT ALL ON public.partner_companies TO service_role;
CREATE POLICY "Public can read partner_companies" ON public.partner_companies FOR SELECT TO anon, authenticated USING (true);
