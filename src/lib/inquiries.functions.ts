import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ChecklistResponseSchema = z.object({
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

export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InquirySchema.parse(data))
  .handler(async ({ data }) => {
    const { insertInquiryAndNotify } = await import("@/lib/inquiries-notify.server");
    return insertInquiryAndNotify(data);
  });
