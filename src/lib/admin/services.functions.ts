import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CHECKLIST_ITEM_TYPES = ["text", "number", "location", "checkbox", "document"] as const;
export type ChecklistItemType = (typeof CHECKLIST_ITEM_TYPES)[number];
export type ChecklistItem = { id: string; label: string; type: ChecklistItemType; unit?: string };

const ChecklistItemSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(CHECKLIST_ITEM_TYPES),
  unit: z.string().max(20).optional(),
});

const ServiceSchema = z.object({
  icon: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  checklist: z.array(ChecklistItemSchema).default([]),
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
