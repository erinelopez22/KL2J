import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NOTIFY_TO = "erinelopez22@gmail.com";

const ChecklistResponseSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "number", "location", "checkbox", "document"]),
  checked: z.boolean().optional(),
  answer: z.string().max(500).optional(),
  documents: z
    .array(z.object({ path: z.string().min(1), name: z.string().min(1).max(200), contentType: z.string().min(1) }))
    .optional()
    .default([]),
});

const InquirySchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(200).optional().nullable(),
    phone: z.string().min(1).max(50).optional().nullable(),
    service: z.string().max(200).optional().nullable(),
    message: z.string().max(4000).optional().nullable(),
    channel: z.string().max(50).optional().nullable(),
    checklist_responses: z.array(ChecklistResponseSchema).optional().default([]),
    status: z.enum(["New", "Ongoing", "Onhold", "Completed", "Rejected", "Cancelled"]).optional().default("New"),
  })
  .refine((d) => d.email || d.phone, { message: "Provide an email or phone number" });

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InquirySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Persist inquiry
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

    // 2) Send email via Gmail SMTP
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
                  return `${esc(c.label)}: ${
                    c.documents && c.documents.length > 0
                      ? `Uploaded (${c.documents.map((d) => esc(d.name)).join(", ")})`
                      : "Not provided"
                  }`;
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

    // 3) Persist email delivery status so failures are visible in the admin inbox,
    // since a failed notification email would otherwise be invisible outside server logs.
    const { error: updateErr } = await supabaseAdmin
      .from("inquiries")
      .update({ email_sent: emailSent, email_error: emailError })
      .eq("id", inserted.id);

    if (updateErr) {
      console.error(`${logPrefix} failed to persist email status`, updateErr);
    }

    return { id: inserted.id, emailSent, emailError };
  });
