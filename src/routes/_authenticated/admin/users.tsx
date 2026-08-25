import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { listAdminUsers, grantRole, revokeRole, createUser, updateUser, deleteUser } from "@/lib/admin/users.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/admin" });
  },
  component: AdminUsers,
});

function AdminUsers() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const confirm = useConfirm();
  const { isAdmin, isSuperAdmin } = Route.useRouteContext();
  const listUsers = useServerFn(listAdminUsers);
  const doCreateUser = useServerFn(createUser);
  const doUpdateUser = useServerFn(updateUser);
  const doDeleteUser = useServerFn(deleteUser);
  const doGrant = useServerFn(grantRole);
  const doRevoke = useServerFn(revokeRole);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "super_admin">("admin");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function grant(targetUserId: string, role: "admin" | "super_admin") {
    try {
      await doGrant({ data: { targetUserId, role } });
      toast.success(`Granted ${role}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant role");
    }
  }

  async function revoke(targetUserId: string, role: "admin" | "super_admin") {
    try {
      await doRevoke({ data: { targetUserId, role } });
      toast.success(`Revoked ${role}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke role");
    }
  }

  async function createNewUser(e: FormEvent) {
    e.preventDefault();
    try {
      await doCreateUser({ data: { email: newEmail, password: newPassword, fullName: newFullName, role: newRole } });
      toast.success("User login created");
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("admin");
      setShowCreateForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  function startEditUser(u: { id: string; email: string; }) {
    setEditingUserId(u.id);
    setEditEmail(u.email);
    setEditPassword("");
    setEditFullName("");
  }

  async function saveEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editingUserId) return;
    try {
      await doUpdateUser({ data: { targetUserId: editingUserId, email: editEmail, password: editPassword || undefined, fullName: editFullName || undefined } });
      toast.success("User updated");
      setEditingUserId(null);
      setEditPassword("");
      setEditFullName("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function deleteExistingUser(targetUserId: string) {
    if (!(await confirm("Delete this user? This cannot be undone.", { destructive: true }))) return;
    try {
      await doDeleteUser({ data: { targetUserId } });
      toast.success("User deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Admin accounts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Admins can update their own account credentials here. Super admins can manage all users.
      </p>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Users</h2>
        {isAdmin && user?.id && (
          <button
            type="button"
            onClick={() => setShowCreateForm((open) => !open)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            {showCreateForm ? "Hide create user" : "Create user login"}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setShowCreateForm(false)}
        >
          <form
            onSubmit={createNewUser}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">Create user login</h2>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3">
              <label className="block">
                <span className="text-sm text-muted-foreground">Email</span>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground">Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground">Full name</span>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground">Role</span>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "super_admin")}
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="admin">admin</option>
                  {isSuperAdmin && <option value="super_admin">super_admin</option>}
                </select>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Create user login
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      <div className="mt-6 space-y-2">
        {users?.map((u) => {
          const canEdit =
            isSuperAdmin ||
            user?.id === u.id ||
            (isAdmin && u.roles.includes("admin") && !u.roles.includes("super_admin"));
          const canDelete = isSuperAdmin && user?.id !== u.id;
          return (
            <div key={u.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{u.email}</div>
                  <div className="flex gap-1.5 text-xs text-muted-foreground">
                    {u.roles.length > 0 ? (
                      u.roles.map((r) => (
                        <span key={r} className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          {r}
                        </span>
                      ))
                    ) : (
                      <span>No roles</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => startEditUser(u)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteExistingUser(u.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-muted"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {editingUserId === u.id && (
                <form onSubmit={saveEditUser} className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-muted-foreground">Password</span>
                    <input
                      type="password"
                      minLength={6}
                      placeholder="Leave blank to keep current"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-muted-foreground">Full name</span>
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <div className="sm:col-span-3 flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-md border border-border bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUserId(null)}
                      className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
