import { supabase } from "@/integrations/supabase/client";

export async function listBoards() {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createBoard(input: { title: string; background: string }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("boards")
    .insert({ title: input.title, background: input.background, owner_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getBoard(id: string) {
  const { data, error } = await supabase.from("boards").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function updateBoard(id: string, patch: { title?: string; background?: string; starred?: boolean }) {
  const { data, error } = await supabase.from("boards").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function getBoardMembers(boardId: string) {
  const { data, error } = await supabase
    .from("board_members")
    .select("user_id, role, profiles:user_id(id, full_name, email, avatar_url)")
    .eq("board_id", boardId);
  if (error) throw error;
  return data;
}
