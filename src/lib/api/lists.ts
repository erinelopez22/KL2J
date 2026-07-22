import { supabase } from "@/integrations/supabase/client";

export async function getListsWithCards(boardId: string) {
  const [{ data: lists, error: le }, { data: cards, error: ce }] = await Promise.all([
    supabase
      .from("lists")
      .select("*")
      .eq("board_id", boardId)
      .eq("archived", false)
      .order("position"),
    supabase
      .from("cards")
      .select("*")
      .eq("board_id", boardId)
      .eq("archived", false)
      .order("position"),
  ]);
  if (le) throw le;
  if (ce) throw ce;
  return { lists: lists ?? [], cards: cards ?? [] };
}

export async function createList(input: { boardId: string; title: string; position: number }) {
  const { data, error } = await supabase
    .from("lists")
    .insert({ board_id: input.boardId, title: input.title, position: input.position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateList(id: string, patch: { title?: string; position?: number; archived?: boolean }) {
  const { data, error } = await supabase.from("lists").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
