import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROJECT_STATUSES = ["Created", "Attended", "On-hold", "Completed", "Cancelled"] as const;

const AttachmentSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  type: z.enum(["image", "video", "document"]),
  name: z.string().min(1).max(200),
});

const ConfidentialAttachmentSchema = z.object({
  path: z.string().min(1),
  type: z.enum(["image", "video", "document"]),
  name: z.string().min(1).max(200),
});

const ProjectSchema = z.object({
  title: z.string().min(1).max(200),
  location: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  service: z.string().max(200).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  personnel: z.array(z.string().min(1).max(200)).default([]),
  cover_photo_url: z.string().url().optional(),
  attachments: z.array(AttachmentSchema).default([]),
  confidential_attachments: z.array(ConfidentialAttachmentSchema).default([]),
  status: z.enum(PROJECT_STATUSES).default("Created"),
  sort_order: z.number().int().default(0),
  inquiry_id: z.string().uuid().optional(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ProjectSchema.extend({ inquiry_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").insert(data);
    if (error) {
      console.error("createProject failed", error);
      throw new Error(`Failed to create project: ${error.message}`);
    }
    return { ok: true };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProjectSchema.partial().extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").update(rest).eq("id", id);
    if (error) {
      console.error("updateProject failed", error);
      throw new Error(`Failed to update project: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) {
      console.error("deleteProject failed", error);
      throw new Error(`Failed to delete project: ${error.message}`);
    }
    return { ok: true };
  });
