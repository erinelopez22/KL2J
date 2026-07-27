CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  contact text NOT NULL,
  service text,
  message text,
  channel text,
  status text NOT NULL DEFAULT 'new'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO anon, authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;