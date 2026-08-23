// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

const NOTIFY_TO = "kl2j.engineering@gmail.com";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

export type ReviewInput = {
  name: string;
  rating: number;
  review_text?: string | null;
  email?: string | null;
};

export async function insertReviewAndNotify(data: ReviewInput): Promise<{ id: string }> {
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

  try {
    const { sendMail } = await import("@/lib/mailer.server");
    const stars = "★".repeat(data.rating) + "☆".repeat(5 - data.rating);
    const html = `
<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111;">
  <h2 style="margin:0 0 12px;color:#8b1e1e;">New review awaiting approval</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#666;width:90px;">Name</td><td>${esc(data.name)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Rating</td><td>${stars} (${data.rating}/5)</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Review</td><td style="white-space:pre-wrap;">${esc(data.review_text || "—")}</td></tr>
  </table>
  <p style="margin-top:16px;font-size:12px;color:#666;">Approve or reject it in the admin panel under Reviews.</p>
</div>`.trim();

    await sendMail({
      to: NOTIFY_TO,
      subject: `New review from ${data.name} (${data.rating}/5) — pending approval`,
      html,
      replyTo: data.email ?? undefined,
    });
  } catch (e) {
    console.error(`[review:${row.id}] notification email failed`, e);
  }

  return { id: row.id as string };
}
