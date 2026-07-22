import { supabase } from "@/integrations/supabase/client";

export async function createCard(input: { boardId: string; listId: string; title: string; position: number }) {
  const { data, error } = await supabase
    .from("cards")
    .insert({ board_id: input.boardId, list_id: input.listId, title: input.title, position: input.position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCard(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    list_id?: string;
    position?: number;
    due_date?: string | null;
    cover_color?: string | null;
    archived?: boolean;
  },
) {
  const { data, error } = await supabase.from("cards").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function getCard(id: string) {
  const { data, error } = await supabase.from("cards").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function getChecklistItems(cardId: string) {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("card_id", cardId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}

export async function addChecklistItem(cardId: string, content: string, position: number) {
  const { data, error } = await supabase
    .from("checklist_items")
    .insert({ card_id: cardId, content, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleChecklistItem(id: string, isDone: boolean) {
  const { error } = await supabase.from("checklist_items").update({ is_done: isDone }).eq("id", id);
  if (error) throw error;
}

export async function deleteChecklistItem(id: string) {
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) throw error;
}

export async function getComments(cardId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles:user_id(id, full_name, email, avatar_url)")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addComment(cardId: string, body: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("comments")
    .insert({ card_id: cardId, user_id: user.id, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}
