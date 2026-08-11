// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

const NOTIFY_TO = "erinelopez22@gmail.com";

type ChecklistResponseInput = {
  id: string;
  label: string;
  type: "text" | "number" | "location" | "checkbox" | "document";
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: { path: string; name: string; contentType: string }[];
};

export type InquiryInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  service?: string | null;
  message?: string | null;
  channel?: string | null;
  checklist_responses?: ChecklistResponseInput[];
  status?: "New" | "Ongoing" | "Onhold" | "Completed" | "Rejected" | "Cancelled";
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

export async function insertInquiryAndNotify(
  data: InquiryInput,
): Promise<{ id: string; emailSent: boolean; emailError: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const contact = data.email || data.phone || "";
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("inquiries")
    .insert({
      name: data.name,
      contact,
      email: data.email ?? null,
      phone: data.phone ?? null,
      service: data.service ?? null,
      message: data.message ?? null,
      channel: data.channel ?? null,
      checklist_responses: data.checklist_responses ?? [],
      status: data.status ?? "New",
    })
    .select("id, created_at")
    .single();

  if (insertErr) {
    console.error("inquiry insert failed", insertErr);
    throw new Error("Failed to save inquiry");
  }

  const { sendMail } = await import("@/lib/mailer.server");

  let emailSent = false;
  let emailError: string | null = null;
  const logPrefix = `[inquiry:${inserted.id}]`;

  try {
    const subject = `New KL2J Inquiry: ${data.service || "General"} — ${data.name}`;
    const checklistHtml =
      data.checklist_responses && data.checklist_responses.length > 0
        ? data.checklist_responses
            .map((c) => {
              if (c.type === "checkbox") return `${c.checked ? "&#9745;" : "&#9744;"} ${esc(c.label)}`;
              if (c.type === "document") {
                const hasFiles = c.documents && c.documents.length > 0;
                const value = hasFiles
                  ? `Yes — ${c.documents!.map((d) => esc(d.name)).join(", ")}`
                  : c.hasDocument
                    ? "Yes (not uploaded)"
                    : "No";
                return `${esc(c.label)}: ${value}`;
              }
              return `${esc(c.label)}: ${esc(c.answer || "—")}`;
            })
            .join("<br/>")
        : "—";
    const html = `
<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111;">
  <h2 style="margin:0 0 12px;color:#8b1e1e;">New inquiry from KL2J website</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#666;width:110px;">Name</td><td>${esc(data.name)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Email</td><td>${esc(data.email || "—")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Phone</td><td>${esc(data.phone || "—")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Service</td><td>${esc(data.service || "—")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Channel</td><td>${esc(data.channel || "chat")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${esc(data.message || "—")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Documents</td><td>${checklistHtml}</td></tr>
  </table>
  <p style="margin-top:16px;font-size:12px;color:#666;">Inquiry ID: ${inserted.id}</p>
</div>`.trim();

    await sendMail({
      to: NOTIFY_TO,
      subject,
      html,
      replyTo: data.email ?? undefined,
    });
    emailSent = true;
    console.log(`${logPrefix} notification email sent to ${NOTIFY_TO}`);
  } catch (e) {
    emailError = e instanceof Error ? e.message : String(e);
    console.error(`${logPrefix} Gmail SMTP send error: ${emailError}`);
  }

  const { error: updateErr } = await supabaseAdmin
    .from("inquiries")
    .update({ email_sent: emailSent, email_error: emailError })
    .eq("id", inserted.id);

  if (updateErr) {
    console.error(`${logPrefix} failed to persist email status`, updateErr);
  }

  return { id: inserted.id, emailSent, emailError };
}
