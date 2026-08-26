// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

const SITE_URL = "https://kl2jlandsurveying.com";

type Attachment = { path: string; name: string; contentType: string };

// Every file exchanged in the comment thread also gets folded into the
// inquiry's own consolidated attachments list, so it shows up in one place
// without digging through individual messages.
export async function appendInquiryAttachments(
  inquiryId: string,
  newAttachments: Attachment[],
): Promise<void> {
  if (newAttachments.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: inquiry, error: fetchErr } = await supabaseAdmin
    .from("inquiries")
    .select("attachments")
    .eq("id", inquiryId)
    .single();
  if (fetchErr) {
    console.error("appendInquiryAttachments fetch failed", fetchErr);
    return;
  }

  const current = (inquiry.attachments as unknown as Attachment[]) ?? [];
  const { error: updateErr } = await supabaseAdmin
    .from("inquiries")
    .update({ attachments: [...current, ...newAttachments] })
    .eq("id", inquiryId);
  if (updateErr) {
    console.error("appendInquiryAttachments update failed", updateErr);
    return;
  }

  const { syncInquiryToLinkedProject } = await import("@/lib/project-inquiry-sync.server");
  await syncInquiryToLinkedProject(inquiryId);
}

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

// Best-effort — a failed notification email should never fail the comment
// post itself.
export async function notifyInquirerOfAdminComment(
  inquiryId: string,
  message: string | null,
  hasAttachments: boolean,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inquiry, error } = await supabaseAdmin
    .from("inquiries")
    .select("email, inquiry_code")
    .eq("id", inquiryId)
    .single();
  if (error || !inquiry?.email || !inquiry.inquiry_code) return;

  try {
    const { sendMail, FROM_ADMIN } = await import("@/lib/mailer.server");
    const preview = message
      ? `<p style="white-space:pre-wrap;">${esc(message)}</p>`
      : "<p>(no message text)</p>";
    await sendMail({
      from: FROM_ADMIN,
      to: inquiry.email,
      subject: "New message from KL2J about your inquiry",
      html: `
<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111;">
  <h2 style="margin:0 0 12px;color:#8b1e1e;">You have a new message from KL2J</h2>
  ${preview}
  ${hasAttachments ? "<p>A file was also attached.</p>" : ""}
  <p>Reply at <a href="${SITE_URL}/my-inquiries?code=${encodeURIComponent(inquiry.inquiry_code)}">${SITE_URL}/my-inquiries</a> — the link above opens your inquiry directly.</p>
</div>`.trim(),
    });
  } catch (e) {
    console.error(`[inquiry:${inquiryId}] admin-comment notification email failed`, e);
  }
}
