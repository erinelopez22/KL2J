import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createService, updateService, deleteService } from "@/lib/admin/services.functions";
import { SERVICE_ICON_NAMES, getServiceIcon } from "@/lib/admin/iconMap";

export const Route = createFileRoute("/_authenticated/admin/services")({
  component: AdminServices,
});

type Service = {
  id: string;
  icon: string;
  title: string;
  description: string;
  sort_order: number;
  active: boolean;
};

type FormState = { icon: string; title: string; description: string; sort_order: number; active: boolean };

const emptyForm: FormState = { icon: SERVICE_ICON_NAMES[0], title: "", description: "", sort_order: 0, active: true };

function AdminServices() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const doCreate = useServerFn(createService);
  const doUpdate = useServerFn(updateService);
  const doDelete = useServerFn(deleteService);

  const { data: services, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw error;
      return data as Service[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    queryClient.invalidateQueries({ queryKey: ["public-services"] });
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setCreating(false);
    setForm({ icon: s.icon, title: s.title, description: s.description, sort_order: s.sort_order, active: s.active });
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: (services?.length ?? 0) + 1 });
  }

  async function submit() {
    try {
      if (editingId) {
        await doUpdate({ data: { id: editingId, ...form } });
        toast.success("Service updated");
      } else {
        await doCreate({ data: form });
        toast.success("Service created");
      }
      setEditingId(null);
      setCreating(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function remove(id: string) {
    try {
      await doDelete({ data: { id } });
      toast.success("Service deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const showForm = creating || editingId;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">Shown as cards in the "Our Services" section.</p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add service
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Icon</span>
              <select
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {SERVICE_ICON_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Sort order</span>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Description</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active (shown publicly)
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setEditingId(null);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {services?.map((s) => {
          const Icon = getServiceIcon(s.icon);
          return (
            <div key={s.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.title}</span>
                  {!s.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => startEdit(s)} className="rounded-md p-2 hover:bg-muted" aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
