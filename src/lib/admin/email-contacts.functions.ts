import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const addEmailContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ email: z.string().email(), name: z.string().max(200).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_contacts")
      .insert({ email: data.email.trim().toLowerCase(), name: data.name?.trim() || null, source: "manual" });
    if (error) {
      if (error.code === "23505") throw new Error("That email is already on the list");
      console.error("addEmailContact failed", error);
      throw new Error(`Failed to add contact: ${error.message}`);
    }
    return { ok: true };
  });

const BulkImportSchema = z.object({
  contacts: z
    .array(z.object({ email: z.string().email(), name: z.string().max(200).optional() }))
    .min(1)
    .max(5000),
});

export const bulkImportEmailContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BulkImportSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Dedupe the incoming batch by email, then skip anything already on the list.
    const byEmail = new Map<string, { email: string; name: string | null }>();
    for (const c of data.contacts) {
      const email = c.email.trim().toLowerCase();
      if (!byEmail.has(email)) byEmail.set(email, { email, name: c.name?.trim() || null });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("email_contacts")
      .select("email")
      .in("email", Array.from(byEmail.keys()));
    if (fetchErr) throw new Error(`Failed to check existing contacts: ${fetchErr.message}`);
    const existingEmails = new Set((existing ?? []).map((r) => r.email));

    const toInsert = Array.from(byEmail.values())
      .filter((c) => !existingEmails.has(c.email))
      .map((c) => ({ ...c, source: "bulk_import" as const }));

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from("email_contacts").insert(toInsert);
      if (insertErr) {
        console.error("bulkImportEmailContacts failed", insertErr);
        throw new Error(`Failed to import contacts: ${insertErr.message}`);
      }
    }

    return { imported: toInsert.length, skipped: byEmail.size - toInsert.length };
  });

export const deleteEmailContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_contacts").delete().eq("id", data.id);
    if (error) {
      console.error("deleteEmailContact failed", error);
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
    return { ok: true };
  });
