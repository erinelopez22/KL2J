-- Standing email contact list for Posts: separate from the per-post
-- resolved-recipient snapshot in post_recipients, and from inquiries (which
-- are customer leads, not a mailing list). Admin can add one at a time or
-- bulk-import via Excel; used as a new "From email list" recipient source
-- when composing a post.
CREATE TABLE IF NOT EXISTS public.email_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'bulk_import')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.email_contacts TO authenticated;
GRANT ALL ON public.email_contacts TO service_role;

CREATE POLICY "Admins can read all email_contacts" ON public.email_contacts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- No anon/authenticated write policies: adding, bulk-importing, and
-- deleting contacts all go through service-role-backed server functions.
