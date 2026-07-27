import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NOTIFY_TO = "erinelopez22@gmail.com";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const InquirySchema = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().min(1).max(200),
  service: z.string().max(200).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
  channel: z.string().max(50).optional().nullable(),
  status: z.string().max(50).optional().default("new"),
});

function b64url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRaw(to: string, subject: string, html: string, replyTo?: string) {
  const headers = [
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ]
    .filter(Boolean)
    .join("\r\n");
  return b64url(`${headers}\r\n\r\n${html}`);
}

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
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("inquiries")
      .insert({
        name: data.name,
        contact: data.contact,
        service: data.service ?? null,
        message: data.message ?? null,
        channel: data.channel ?? null,
        status: data.status ?? "new",
      })
      .select("id, created_at")
      .single();

    if (insertErr) {
      console.error("inquiry insert failed", insertErr);
      throw new Error("Failed to save inquiry");
    }

    // 2) Send email via Gmail connector gateway
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;

    let emailSent = false;
    let emailError: string | null = null;

    if (!lovableKey || !gmailKey) {
      emailError = "Email sender not configured";
      console.error(emailError);
    } else {
      try {
        const subject = `New KL2J Inquiry: ${data.service || "General"} — ${data.name}`;
        const replyToIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact);
        const html = `
<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111;">
  <h2 style="margin:0 0 12px;color:#8b1e1e;">New inquiry from KL2J website</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#666;width:110px;">Name</td><td>${esc(data.name)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Contact</td><td>${esc(data.contact)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Service</td><td>${esc(data.service || "—")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Channel</td><td>${esc(data.channel || "chat")}</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${esc(data.message || "—")}</td></tr>
  </table>
  <p style="margin-top:16px;font-size:12px;color:#666;">Inquiry ID: ${inserted.id}</p>
</div>`.trim();

        const raw = buildRaw(NOTIFY_TO, subject, html, replyToIsEmail ? data.contact : undefined);

        const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmailKey,
          },
          body: JSON.stringify({ raw }),
        });

        if (!res.ok) {
          const body = await res.text();
          emailError = `Gmail send failed [${res.status}]: ${body}`;
          console.error(emailError);
        } else {
          emailSent = true;
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : String(e);
        console.error("Gmail send error", emailError);
      }
    }

    return { id: inserted.id, emailSent, emailError };
  });
