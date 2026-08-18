-- Editable hero position/zoom (x/y as object-position percentages, zoom as
-- a CSS scale multiplier) and editable headline/subtitle text, both applied
-- to the public homepage hero via src/routes/index.tsx's Hero().
ALTER TABLE public.site_settings
  ADD COLUMN hero_banner_position jsonb NOT NULL DEFAULT '{"x":50,"y":50,"zoom":1}',
  ADD COLUMN hero_headline text,
  ADD COLUMN hero_subtitle text;
