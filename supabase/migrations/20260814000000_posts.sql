-- Admin "Posts" broadcast system: admin-authored announcements (project
-- completions, service updates, company-profile updates, general updates)
-- sent by email to customers pulled from the inquiries table. Email-only —
-- no public-facing page.

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('project', 'service', 'profile', 'update')),
  title text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  project_ids uuid[] NOT NULL DEFAULT '{}',
  recipient_mode text NOT NULL DEFAULT 'none' CHECK (recipient_mode IN ('none', 'all', 'selected')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent')),
  total_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.post_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text,
  source text NOT NULL CHECK (source IN ('inquiry', 'custom')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, email)
);

CREATE INDEX IF NOT EXISTS post_recipients_post_status_idx ON public.post_recipients (post_id, status);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_recipients ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
GRANT SELECT ON public.post_recipients TO authenticated;
GRANT ALL ON public.post_recipients TO service_role;

CREATE POLICY "Admins can read all posts" ON public.posts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can read all post_recipients" ON public.post_recipients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- No anon/authenticated write policies: creating, editing, resolving
-- recipients for, and sending posts all go through service-role-backed
-- server functions, not direct client writes.
