import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ChecklistResponseSchema } from "@/lib/inquiries.functions";

const INQUIRY_STATUSES = ["New", "Ongoing", "Onhold", "Completed", "Rejected", "Cancelled"] as const;

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(INQUIRY_STATUSES),
});

const CreateInquirySchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(200).optional(),
    phone: z.string().min(1).max(50).optional(),
    service: z.string().max(200).optional(),
    message: z.string().max(4000).optional(),
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
      channel: "manual",
      checklist_responses: data.checklist_responses,
      status: "New",
    });
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
