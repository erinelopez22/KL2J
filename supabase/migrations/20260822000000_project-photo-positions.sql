ALTER TABLE public.projects
  ADD COLUMN photo_positions jsonb NOT NULL DEFAULT '{}'::jsonb;
