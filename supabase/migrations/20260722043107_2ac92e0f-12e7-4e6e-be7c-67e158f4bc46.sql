
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_labels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards, public.board_members, public.lists, public.cards, public.labels, public.card_labels, public.card_members, public.checklist_items, public.comments, public.profiles, public.user_roles TO anon, authenticated;
