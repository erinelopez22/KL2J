-- Public inquiry tracking: every inquiry gets a shareable code (generated
-- app-side on insert) so an anonymous inquirer can look up their own
-- inquiry without an account, plus a two-way comment thread between the
-- inquirer and admins.

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS inquiry_code text UNIQUE;

CREATE TABLE IF NOT EXISTS public.inquiry_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('admin', 'inquirer')),
  author_name text,
  message text,
  attachments jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inquiry_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.inquiry_comments TO authenticated;
GRANT ALL ON public.inquiry_comments TO service_role;

CREATE POLICY "Admins can read all inquiry comments" ON public.inquiry_comments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- No anon/public policies: the inquirer side never touches this table
-- directly (there's no login to scope RLS to for an anonymous visitor) —
-- all inquirer reads/writes go through service-role-backed server
-- functions that validate the inquiry code first.
