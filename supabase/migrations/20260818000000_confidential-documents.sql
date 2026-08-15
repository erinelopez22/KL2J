-- Confidential documents: admin-only files (contracts, internal permits,
-- etc.) shown on the same admin Documents page as the public ones, but
-- never exposed publicly. Stored in the private "confidential-media"
-- bucket (never publicly readable) with the file only ever accessed via
-- short-lived signed URLs, same posture as project confidential attachments.

CREATE TABLE public.confidential_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  storage_path text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.confidential_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.confidential_documents TO authenticated;
GRANT ALL ON public.confidential_documents TO service_role;

-- No anon/public policy on purpose — only admins may see this table at all.
CREATE POLICY "Admins can read all confidential_documents" ON public.confidential_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
