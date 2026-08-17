-- gallery_photos is now the sole source of truth for a project's photos/
-- videos (projects.attachments holds documents only). Public project pages
-- query gallery_photos by folder_id, so index it.
CREATE INDEX IF NOT EXISTS gallery_photos_folder_id_idx ON public.gallery_photos (folder_id);
