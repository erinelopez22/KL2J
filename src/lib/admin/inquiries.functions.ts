import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INQUIRY_STATUSES = ["New", "Ongoing", "Onhold", "Completed", "Rejected", "Cancelled"] as const;

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(INQUIRY_STATUSES),
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
