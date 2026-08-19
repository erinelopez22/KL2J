-- Enables Supabase Realtime (postgres_changes) for tables the app now
-- subscribes to client-side, so admin/public pages refresh live instead of
-- needing a manual reload. `inquiries`, `inquiry_comments`, and `reviews`
-- were already in this publication (existing notification-bell and
-- admin-inquiries-kanban realtime already depend on them); this adds the
-- three tables newly wired up for live project/gallery updates.

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_folders;
