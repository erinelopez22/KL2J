-- Unsubscribe suppression list for Posts announcement emails. Anyone here
-- is permanently excluded from future post recipient resolution
-- (see resolveRecipients in posts.functions.ts) until removed.
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  unsubscribed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_suppressions_email_idx ON public.email_suppressions (email);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.email_suppressions TO authenticated;
GRANT ALL ON public.email_suppressions TO service_role;

CREATE POLICY "Admins can read email_suppressions" ON public.email_suppressions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- No anon/authenticated write policy — inserts only happen through the
-- token-verified confirmUnsubscribe server function (service role).
