-- Multiple project cover photos, shown as a horizontal strip on the public
-- site. The original photo_urls column (added in 20260728000000, dropped in
-- 20260728020000 when attachments/gallery took over media) is re-added here
-- for this unrelated purpose — cover photos specifically, not the general
-- project media gallery (which lives in gallery_photos).
ALTER TABLE public.projects
  ADD COLUMN photo_urls text[] NOT NULL DEFAULT '{}';
