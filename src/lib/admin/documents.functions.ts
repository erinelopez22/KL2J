import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DocumentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(["license", "registration", "other"]).default("other"),
  url: z.string().url(),
  storage_path: z.string().min(1),
  sort_order: z.number().int().default(0),
});

export const addDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DocumentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("documents").insert(data);
    if (error) {
      console.error("addDocument failed", error);
      throw new Error(`Failed to save document: ${error.message}`);
    }
    return { ok: true };
  });

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    DocumentSchema.omit({ url: true, storage_path: true })
      .partial()
      .extend({ id: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("documents").update(rest).eq("id", id);
    if (error) {
      console.error("updateDocument failed", error);
      throw new Error(`Failed to update document: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), storage_path: z.string().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("documents").delete().eq("id", data.id);
    if (error) {
      console.error("deleteDocument failed", error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
    if (data.storage_path) {
      await supabaseAdmin.storage.from("site-media").remove([data.storage_path]);
    }
    return { ok: true };
  });

// Confidential documents: same shape as public documents, but the file lives
// in the private "confidential-media" bucket and the row itself is never
// exposed to anon/public RLS — see the confidential_documents migration.
const ConfidentialDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(["license", "registration", "other"]).default("other"),
  storage_path: z.string().min(1),
  sort_order: z.number().int().default(0),
});

export const addConfidentialDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConfidentialDocumentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("confidential_documents").insert(data);
    if (error) {
      console.error("addConfidentialDocument failed", error);
      throw new Error(`Failed to save document: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteConfidentialDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), storage_path: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("confidential_documents").delete().eq("id", data.id);
    if (error) {
      console.error("deleteConfidentialDocument failed", error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
    await supabaseAdmin.storage.from("confidential-media").remove([data.storage_path]);
    return { ok: true };
  });
