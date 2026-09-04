-- Tracks whether a gallery photo has had the KL2J text watermark drawn
-- into its pixels — via the upload-time checkbox (FileDrop's
-- allowWatermarkToggle) or the "Add watermark" bulk action on already-
-- uploaded photos in /admin/gallery. Baked into the file itself (not a
-- CSS overlay), so it can't be bypassed by saving the image directly —
-- which also means it's permanent: there is no "remove watermark" action,
-- since there's nothing to computationally undo once the pixels are
-- blended in. Defaults to false so every existing photo is (correctly)
-- treated as not-yet-watermarked.
ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS watermarked boolean NOT NULL DEFAULT false;
