import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AddCompanySchema = z.object({
  name: z.string().min(1).max(200),
  logo_url: z.string().url(),
  storage_path: z.string().min(1).optional(),
  website_url: z.string().url().optional(),
  sort_order: z.number().int().default(0),
});

export const addPartnerCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partner_companies").insert(data);
    if (error) {
      console.error("addPartnerCompany failed", error);
      throw new Error(`Failed to save company: ${error.message}`);
    }
    return { ok: true };
  });

const UpdateCompanySchema = AddCompanySchema.partial().extend({ id: z.string().uuid() });

export const updatePartnerCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { id, ...update } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partner_companies").update(update).eq("id", id);
    if (error) {
      console.error("updatePartnerCompany failed", error);
      throw new Error(`Failed to update company: ${error.message}`);
    }
    return { ok: true };
  });

export const deletePartnerCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), storage_path: z.string().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partner_companies").delete().eq("id", data.id);
    if (error) {
      console.error("deletePartnerCompany failed", error);
      throw new Error(`Failed to delete company: ${error.message}`);
    }
    if (data.storage_path) {
      await supabaseAdmin.storage.from("site-media").remove([data.storage_path]);
    }
    return { ok: true };
  });
