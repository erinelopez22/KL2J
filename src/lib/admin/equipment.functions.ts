import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EquipmentMediaSchema = z.object({
  url: z.string().url(),
  path: z.string().optional(),
  contentType: z.string().min(1),
  kind: z.enum(["image", "video", "document"]),
  name: z.string().min(1).max(200),
  isExternalLink: z.boolean().optional(),
});

const EquipmentSchema = z.object({
  icon: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
  media: z.array(EquipmentMediaSchema).default([]),
});

export const createEquipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EquipmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("equipment").insert(data);
    if (error) {
      console.error("createEquipment failed", error);
      throw new Error(`Failed to create equipment: ${error.message}`);
    }
    return { ok: true };
  });

export const updateEquipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EquipmentSchema.partial().extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("equipment").update(rest).eq("id", id);
    if (error) {
      console.error("updateEquipment failed", error);
      throw new Error(`Failed to update equipment: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteEquipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("equipment")
      .select("media")
      .eq("id", data.id)
      .single();
    if (row?.media) {
      const { removeStoragePaths } = await import("@/lib/storageCleanup.server");
      const media = row.media as unknown as z.infer<typeof EquipmentMediaSchema>[];
      const paths = media
        .filter((m) => !m.isExternalLink && m.path)
        .map((m) => m.path as string);
      await removeStoragePaths("site-media", paths);
    }

    const { error } = await supabaseAdmin.from("equipment").delete().eq("id", data.id);
    if (error) {
      console.error("deleteEquipment failed", error);
      throw new Error(`Failed to delete equipment: ${error.message}`);
    }
    return { ok: true };
  });
