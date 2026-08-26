// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

export type ReviewInput = {
  name: string;
  rating: number;
  review_text?: string | null;
  email?: string | null;
};

export async function insertReview(data: ReviewInput): Promise<{ id: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error } = await supabaseAdmin
    .from("reviews")
    .insert({
      name: data.name,
      rating: data.rating,
      review_text: data.review_text ?? null,
      email: data.email ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !row) {
    console.error("review insert failed", error);
    throw new Error("Failed to submit review");
  }

  return { id: row.id as string };
}
