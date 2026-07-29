import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getUserRoles } = await import("@/lib/admin/roles.server");
    const roles = await getUserRoles(context.userId);
    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin") || isSuperAdmin;
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let users: Array<{ id: string; email: string | null; created_at: string | null }> = [];

    if (isSuperAdmin) {
      const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (usersErr) {
        console.error("listAdminUsers/listUsers failed", usersErr);
        throw new Error("Failed to list users");
      }
      users = usersData.users.map((u) => ({ id: u.id, email: u.email ?? null, created_at: u.created_at ?? null }));
    } else {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      if (userErr || !userData?.user) {
        console.error("listAdminUsers/self failed", userErr);
        throw new Error("Failed to load user");
      }
      users = [{ id: userData.user.id, email: userData.user.email ?? null, created_at: userData.user.created_at ?? null }];
    }

    const { data: roleRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in(
        "user_id",
        isSuperAdmin ? users.map((u) => u.id) : [context.userId],
      );
    if (rolesErr) {
      console.error("listAdminUsers/roles failed", rolesErr);
      throw new Error("Failed to load roles");
    }

    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    return users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      roles: rolesByUser.get(u.id) ?? [],
    }));
  });

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().optional(),
  role: z.enum(["admin", "super_admin"]),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "super_admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      user_metadata: { full_name: data.fullName ?? data.email },
      email_confirm: true,
    });

    if (error) {
      console.error("createUser failed", error);
      throw new Error(error.message || "Failed to create user");
    }

    const newUserId = created.user?.id;
    if (newUserId) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newUserId, role: data.role }, { onConflict: "user_id,role" });
      if (roleError) {
        console.error("createUser/grantRole failed", roleError);
        throw new Error(`User created but failed to grant role: ${roleError.message}`);
      }
    }

    return {
      id: newUserId ?? "",
      email: created.user?.email ?? data.email,
    };
  });

const UpdateUserSchema = z.object({
  targetUserId: z.string().uuid(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  fullName: z.string().optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { getUserRoles } = await import("@/lib/admin/roles.server");
    const roles = await getUserRoles(context.userId);
    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin") || isSuperAdmin;
    if (!isAdmin) throw new Error("Forbidden");
    if (!isSuperAdmin && data.targetUserId !== context.userId) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updatePayload: Record<string, unknown> = {};
    if (data.email) updatePayload.email = data.email;
    if (data.password) updatePayload.password = data.password;
    if (data.fullName) updatePayload.user_metadata = { full_name: data.fullName };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, updatePayload);
    if (error) {
      console.error("updateUser failed", error);
      throw new Error(error.message || "Failed to update user");
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ targetUserId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "super_admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) {
      console.error("deleteUser failed", error);
      throw new Error(error.message || "Failed to delete user");
    }

    return { ok: true };
  });

const SetRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  role: z.enum(["admin", "super_admin"]),
});

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "super_admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.targetUserId, role: data.role }, { onConflict: "user_id,role" });
    if (error) {
      console.error("grantRole failed", error);
      throw new Error(`Failed to grant role: ${error.message}`);
    }
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "super_admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("role", data.role);
    if (error) {
      console.error("revokeRole failed", error);
      throw new Error(`Failed to revoke role: ${error.message}`);
    }
    return { ok: true };
  });
