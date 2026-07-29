import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ServiceSchema = z.object({
  icon: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const createService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ServiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("services").insert(data);
    if (error) {
      console.error("createService failed", error);
      throw new Error(`Failed to create service: ${error.message}`);
    }
    return { ok: true };
  });

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ServiceSchema.partial().extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("services").update(rest).eq("id", id);
    if (error) {
      console.error("updateService failed", error);
      throw new Error(`Failed to update service: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("services").delete().eq("id", data.id);
    if (error) {
      console.error("deleteService failed", error);
      throw new Error(`Failed to delete service: ${error.message}`);
    }
    return { ok: true };
  });
