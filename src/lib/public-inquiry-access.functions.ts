import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SITE_URL = "https://kl2j--kl2j-98e80.us-central1.hosted.app";

const AttachmentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(200),
  contentType: z.string().min(1),
  isExternalLink: z.boolean().optional(),
});

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function namesMatch(inputName: string, storedName: string): boolean {
  const inputWords = inputName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const storedWords = storedName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (inputWords.length === 0) return false;
  return inputWords.every((w) => storedWords.includes(w));
}

// Looks up a single inquiry (with its comment thread) by its public tracking
// code. The code IS the credential here — there's no login for inquirers.
export const lookupInquiryByCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(1).max(30) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);

    const { data: inquiry, error } = await supabaseAdmin
      .from("inquiries")
      .select(
        "id, name, email, phone, service, services, message, status, created_at, checklist_responses, attachments",
      )
      .eq("inquiry_code", code)
      .maybeSingle();
    if (error) {
      console.error("lookupInquiryByCode failed", error);
      throw new Error("Something went wrong. Please try again.");
    }
    if (!inquiry) throw new Error("We couldn't find an inquiry with that code.");

    const { data: comments, error: commentsErr } = await supabaseAdmin
      .from("inquiry_comments")
      .select("id, author_type, author_name, message, attachments, created_at")
      .eq("inquiry_id", inquiry.id)
      .order("created_at", { ascending: true });
    if (commentsErr) {
      console.error("lookupInquiryByCode comments failed", commentsErr);
    }

    return { ...inquiry, comments: comments ?? [] };
  });

// Forgot-code recovery: match on email + any part of the inquirer's name.
// If matched, re-sends the code(s) by email rather than returning them
// directly in the response.
export const recoverInquiryCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().email().max(200), name: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("inquiries")
      .select("id, name, inquiry_code")
      .ilike("email", data.email.trim());
    if (error) {
      console.error("recoverInquiryCode lookup failed", error);
      throw new Error("Something went wrong. Please try again.");
    }

    const matches = (rows ?? []).filter(
      (r): r is typeof r & { inquiry_code: string } => Boolean(r.inquiry_code) && namesMatch(data.name, r.name),
    );
    if (matches.length === 0) {
      return { matched: false };
    }

    const { sendMail } = await import("@/lib/mailer.server");
    const codeList = matches.map((m) => m.inquiry_code).join(", ");
    try {
      await sendMail({
        to: data.email.trim(),
        subject: "Your KL2J inquiry code(s)",
        html: `
<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111;">
  <h2 style="margin:0 0 12px;color:#8b1e1e;">Here ${matches.length === 1 ? "is your inquiry code" : "are your inquiry codes"}</h2>
  <p style="font-size:20px;font-weight:700;color:#8b1e1e;">${codeList}</p>
  <p>Use ${matches.length === 1 ? "it" : "any of them"} at <a href="${SITE_URL}/my-inquiries">${SITE_URL}/my-inquiries</a> to check your inquiry.</p>
</div>`.trim(),
      });
    } catch (e) {
      console.error("recoverInquiryCode email send failed", e);
      throw new Error("We found your inquiry but couldn't send the email. Please try again shortly.");
    }
    return { matched: true };
  });

// Inquirer posts a message/attachment into the thread, gated by their code.
export const addInquiryComment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().min(1).max(30),
        message: z.string().max(2000).optional(),
        attachments: z.array(AttachmentSchema).optional().default([]),
      })
      .refine((d) => (d.message && d.message.trim().length > 0) || d.attachments.length > 0, {
        message: "Write a message or attach a file",
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);

    const { data: inquiry, error: findErr } = await supabaseAdmin
      .from("inquiries")
      .select("id, name")
      .eq("inquiry_code", code)
      .maybeSingle();
    if (findErr || !inquiry) throw new Error("Invalid inquiry code");

    const { error } = await supabaseAdmin.from("inquiry_comments").insert({
      inquiry_id: inquiry.id,
      author_type: "inquirer",
      author_name: inquiry.name,
      message: data.message?.trim() || null,
      attachments: data.attachments,
    });
    if (error) {
      console.error("addInquiryComment failed", error);
      throw new Error("Failed to send message");
    }

    const { appendInquiryAttachments } = await import("@/lib/inquiry-comments.server");
    await appendInquiryAttachments(inquiry.id, data.attachments);

    return { ok: true };
  });

// Code-gated signed URL for viewing a file in the thread (including
// admin-uploaded attachments) — verifies the path actually belongs to this
// inquiry before issuing a link, so a valid code can't be used to fetch
// arbitrary paths from the shared private bucket.
export const getInquiryCommentFileUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(1).max(30), path: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);

    const { data: inquiry, error: findErr } = await supabaseAdmin
      .from("inquiries")
      .select("id, checklist_responses")
      .eq("inquiry_code", code)
      .maybeSingle();
    if (findErr || !inquiry) throw new Error("Invalid inquiry code");

    const checklist = (inquiry.checklist_responses as unknown as { documents?: { path: string }[] }[]) ?? [];
    const ownDocPaths = new Set(checklist.flatMap((c) => (c.documents ?? []).map((d) => d.path)));

    let allowed = ownDocPaths.has(data.path);
    if (!allowed) {
      const { data: comments } = await supabaseAdmin
        .from("inquiry_comments")
        .select("attachments")
        .eq("inquiry_id", inquiry.id);
      allowed = (comments ?? []).some((c) =>
        ((c.attachments as unknown as { path: string }[]) ?? []).some((a) => a.path === data.path),
      );
    }
    if (!allowed) throw new Error("File not found for this inquiry");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("confidential-media")
      .createSignedUrl(data.path, 300);
    if (error || !signed) {
      console.error("getInquiryCommentFileUrl failed", error);
      throw new Error("Failed to get file link");
    }
    return { url: signed.signedUrl };
  });
