CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon text NOT NULL DEFAULT 'Ruler',
  title text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.equipment TO anon, authenticated;
GRANT ALL ON public.equipment TO service_role;

CREATE POLICY "Public can read equipment" ON public.equipment
  FOR SELECT TO anon, authenticated USING (true);
