import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HeroPositionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3),
});

const BrandingSchema = z.object({
  logo_url: z.string().url().optional(),
  favicon_url: z.string().url().optional(),
  hero_banner_url: z.string().url().optional(),
  hero_banner_position: HeroPositionSchema.optional(),
  hero_headline: z.string().max(200).optional(),
  hero_subtitle: z.string().max(500).optional(),
  email_cover_photo_url: z.string().url().nullable().optional(),
  email_cover_photo_by_type: z.record(z.string(), z.string().url()).optional(),
  contact_phones: z.array(z.string().min(1).max(50)).optional(),
  contact_email: z.string().email().nullable().optional(),
  service_area_text: z.string().max(200).nullable().optional(),
});

export const updateBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BrandingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      console.error("updateBranding failed", error);
      throw new Error(`Failed to update branding: ${error.message}`);
    }
    return { ok: true };
  });
