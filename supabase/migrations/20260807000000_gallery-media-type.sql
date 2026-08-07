-- Field gallery now supports videos in addition to photos.
ALTER TABLE public.gallery_photos
  ADD COLUMN media_type text NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video'));
