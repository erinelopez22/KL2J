import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ChecklistResponseSchema } from "@/lib/inquiries.functions";

const INQUIRY_STATUSES = ["New", "Ongoing", "Onhold", "Completed", "Rejected", "Cancelled"] as const;

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(INQUIRY_STATUSES),
});

// Every manually-added inquiry (whether from the Inquiries page's "Add
// inquiry" form or the New Project popup's quick-create shortcuts) must say
// how the customer actually reached out, so it's identifiable in the
// inquiries list rather than lumped under a generic "added by admin" tag.
export const MANUAL_INQUIRY_CHANNELS = ["referral", "facebook", "others"] as const;
export type ManualInquiryChannel = (typeof MANUAL_INQUIRY_CHANNELS)[number];

const CreateInquirySchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(200).optional(),
    phone: z.string().min(1).max(50).optional(),
    service: z.string().max(200).optional(),
    message: z.string().max(4000).optional(),
    channel: z.enum(MANUAL_INQUIRY_CHANNELS),
    checklist_responses: z.array(ChecklistResponseSchema).optional().default([]),
  })
  .refine((d) => d.email || d.phone, { message: "Provide an email or phone number" });

export const createInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInquirySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { insertInquiryAndNotify } = await import("@/lib/inquiries-notify.server");
    return insertInquiryAndNotify({
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      service: data.service ?? null,
      message: data.message ?? null,
      channel: data.channel,
      checklist_responses: data.checklist_responses,
      status: "New",
    });
  });

// inquiry_comments cascades on delete (ON DELETE CASCADE), and
// projects.inquiry_id / posts.inquiry_id both fall back to null
// (ON DELETE SET NULL) — no extra cleanup needed beyond the row itself.
export const deleteInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("inquiries").delete().eq("id", data.id);
    if (error) {
      console.error("deleteInquiry failed", error);
      throw new Error(`Failed to delete inquiry: ${error.message}`);
    }
    return { ok: true };
  });

export const updateInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("inquiries").update({ status: data.status }).eq("id", data.id);
    if (error) {
      console.error("updateInquiryStatus failed", error);
      throw new Error(`Failed to update status: ${error.message}`);
    }
    return { ok: true };
  });

const AddAdminCommentSchema = z
  .object({
    inquiryId: z.string().uuid(),
    message: z.string().max(2000).optional(),
    attachments: z
      .array(
        z.object({
          path: z.string().min(1),
          name: z.string().min(1).max(200),
          contentType: z.string().min(1),
          isExternalLink: z.boolean().optional(),
        }),
      )
      .optional()
      .default([]),
  })
  .refine((d) => (d.message && d.message.trim().length > 0) || d.attachments.length > 0, {
    message: "Write a message or attach a file",
  });

export const addAdminInquiryComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddAdminCommentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authorName = typeof context.claims.email === "string" ? context.claims.email : "KL2J Team";
    const { error } = await supabaseAdmin.from("inquiry_comments").insert({
      inquiry_id: data.inquiryId,
      author_type: "admin",
      author_name: authorName,
      message: data.message?.trim() || null,
      attachments: data.attachments,
    });
    if (error) {
      console.error("addAdminInquiryComment failed", error);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    const { appendInquiryAttachments, notifyInquirerOfAdminComment } = await import(
      "@/lib/inquiry-comments.server"
    );
    await appendInquiryAttachments(data.inquiryId, data.attachments);
    await notifyInquirerOfAdminComment(data.inquiryId, data.message?.trim() || null, data.attachments.length > 0);

    return { ok: true };
  });

// Marks an inquiry's inquirer-authored comments as read — called when the
// admin opens that inquiry's Comments tab, so the notification bell's
// unread-messages count clears for it.
export const markInquiryCommentsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ inquiryId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("inquiry_comments")
      .update({ is_read: true })
      .eq("inquiry_id", data.inquiryId)
      .eq("author_type", "inquirer")
      .eq("is_read", false);
    if (error) {
      console.error("markInquiryCommentsRead failed", error);
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
    return { ok: true };
  });
