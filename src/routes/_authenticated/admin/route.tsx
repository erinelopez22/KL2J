import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminNav } from "@/components/admin/AdminNav";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id);
    if (error) throw redirect({ to: "/" });

    const roles = (data ?? []).map((r) => r.role);
    const isAdmin = roles.includes("admin") || roles.includes("super_admin");
    const isSuperAdmin = roles.includes("super_admin");
    if (!isAdmin) throw redirect({ to: "/" });

    return { isAdmin, isSuperAdmin };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, isSuperAdmin } = Route.useRouteContext();
  const { pathname } = useLocation();
  const fullBleed = pathname === "/admin/preview";

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminNav isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
      {fullBleed ? (
        <Outlet />
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="rounded-xl border border-border bg-background p-6 shadow-md sm:p-8">
            <Outlet />
          </div>
        </main>
      )}
    </div>
  );
}
