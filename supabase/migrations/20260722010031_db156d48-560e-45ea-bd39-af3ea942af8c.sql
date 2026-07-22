
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Boards
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT 'blue',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starred BOOLEAN NOT NULL DEFAULT false,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Board members
CREATE TABLE public.board_members (
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_members TO authenticated;
GRANT ALL ON public.board_members TO service_role;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_board_member(_board_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id
    UNION
    SELECT 1 FROM public.boards WHERE id = _board_id AND owner_id = _user_id
  );
$$;

-- Board policies
CREATE POLICY "Members can view boards" ON public.boards FOR SELECT TO authenticated USING (public.is_board_member(id, auth.uid()));
CREATE POLICY "Users can create boards" ON public.boards FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update boards" ON public.boards FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete boards" ON public.boards FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Board member policies
CREATE POLICY "Members can view board_members" ON public.board_members FOR SELECT TO authenticated USING (public.is_board_member(board_id, auth.uid()));
CREATE POLICY "Board owners manage members" ON public.board_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid()));
CREATE POLICY "Users can add self as member" ON public.board_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-add owner as member trigger
CREATE OR REPLACE FUNCTION public.handle_new_board()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_board_created AFTER INSERT ON public.boards FOR EACH ROW EXECUTE FUNCTION public.handle_new_board();

-- Lists
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL DEFAULT 65536,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO authenticated;
GRANT ALL ON public.lists TO service_role;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage lists" ON public.lists FOR ALL TO authenticated
  USING (public.is_board_member(board_id, auth.uid()))
  WITH CHECK (public.is_board_member(board_id, auth.uid()));
CREATE INDEX lists_board_position_idx ON public.lists(board_id, position);

-- Cards
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position DOUBLE PRECISION NOT NULL DEFAULT 65536,
  due_date TIMESTAMPTZ,
  cover_color TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage cards" ON public.cards FOR ALL TO authenticated
  USING (public.is_board_member(board_id, auth.uid()))
  WITH CHECK (public.is_board_member(board_id, auth.uid()));
CREATE INDEX cards_list_position_idx ON public.cards(list_id, position);

-- Labels
CREATE TABLE public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labels TO authenticated;
GRANT ALL ON public.labels TO service_role;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage labels" ON public.labels FOR ALL TO authenticated
  USING (public.is_board_member(board_id, auth.uid()))
  WITH CHECK (public.is_board_member(board_id, auth.uid()));

-- Card labels
CREATE TABLE public.card_labels (
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_labels TO authenticated;
GRANT ALL ON public.card_labels TO service_role;
ALTER TABLE public.card_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage card_labels" ON public.card_labels FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())));

-- Card members
CREATE TABLE public.card_members (
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_members TO authenticated;
GRANT ALL ON public.card_members TO service_role;
ALTER TABLE public.card_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage card_members" ON public.card_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())));

-- Checklist items
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  position DOUBLE PRECISION NOT NULL DEFAULT 65536,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage checklist_items" ON public.checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())));

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view comments" ON public.comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())));
CREATE POLICY "Members can create comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND public.is_board_member(c.board_id, auth.uid())));
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
