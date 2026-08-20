ALTER TABLE public.equipment ADD COLUMN media jsonb NOT NULL DEFAULT '[]'::jsonb;
