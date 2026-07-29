// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole = "super_admin" | "admin" | "user";

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Failed to load roles");
  return (data ?? []).map((r) => r.role as AppRole);
}

export async function assertRole(userId: string, required: "admin" | "super_admin") {
  const roles = await getUserRoles(userId);
  const ok =
    required === "admin"
      ? roles.includes("admin") || roles.includes("super_admin")
      : roles.includes("super_admin");
  if (!ok) throw new Error("Forbidden");
}
