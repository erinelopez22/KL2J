-- Admin CMS panel: re-secure user_roles, add content tables, add public storage bucket.

-- ============================================================
-- 1) Re-secure user_roles — RLS was disabled and anon/authenticated were
--    granted full CRUD by an earlier migration. Only service_role (i.e. only
--    server functions that have already verified the caller's role) may write.
-- ============================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 2) site_settings — singleton row for branding (logo/favicon/hero banner)
-- ============================================================

CREATE TABLE public.site_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url text,
  favicon_url text,
  hero_banner_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id) VALUES (1);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
CREATE POLICY "Public can read site settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 3) services — the "Our Services" cards
-- ============================================================

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon text NOT NULL DEFAULT 'Compass',
  title text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
CREATE POLICY "Public can read services" ON public.services FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.services (icon, title, description, sort_order) VALUES
('MapPin', 'Relocation Survey', 'Re-establish lost or disputed property corners on the ground using approved technical descriptions and titles.', 1),
('Split', 'Subdivision Survey', 'Divide a titled parcel into two or more lots with individual technical descriptions ready for titling.', 2),
('Combine', 'Consolidation Survey', 'Merge two or more adjoining lots into a single titled property with a unified boundary description.', 3),
('Mountain', 'Topographic Survey', 'Capture ground elevations, contours, and features for architectural, engineering, and site development plans.', 4),
('Layers', 'Consolidation-Subdivision Survey', 'Combine adjoining lots and re-subdivide them into new, precisely defined parcels in one approved plan.', 5),
('ShieldCheck', 'Verification Survey', 'Confirm boundaries, monuments, and areas of existing surveys against records to resolve discrepancies.', 6),
('Building2', 'As-Built Survey', 'Document the exact location of constructed improvements for compliance, occupancy, and turnover requirements.', 7),
('FileCheck2', 'Land Titling Assistance', 'End-to-end guidance through DENR-LMB, LRA, and Registry of Deeds processing to secure your land title.', 8);

-- ============================================================
-- 4) gallery_photos — field gallery (seeded separately via upload script)
-- ============================================================

CREATE TABLE public.gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  storage_path text,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gallery_photos TO anon, authenticated;
GRANT ALL ON public.gallery_photos TO service_role;
CREATE POLICY "Public can read gallery_photos" ON public.gallery_photos FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 5) documents — licenses/registrations/other business documents
--    (seeded separately via upload script)
-- ============================================================

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  url text NOT NULL,
  storage_path text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.documents TO anon, authenticated;
GRANT ALL ON public.documents TO service_role;
CREATE POLICY "Public can read documents" ON public.documents FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 6) projects — public portfolio / case studies
-- ============================================================

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  service text,
  project_date date,
  cover_photo_url text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
-- Only published projects are visible to the public site; service_role (admin
-- backend) bypasses RLS entirely, so drafts stay visible in /admin.
CREATE POLICY "Public can read published projects" ON public.projects FOR SELECT TO anon, authenticated USING (published = true);

-- ============================================================
-- 7) Storage — public bucket for all admin-managed media
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-media', 'site-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read site-media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-media');
