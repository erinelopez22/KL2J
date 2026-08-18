import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, ListChecks, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createService,
  updateService,
  deleteService,
  CHECKLIST_ITEM_TYPES,
  type ChecklistItem,
  type ChecklistItemType,
} from "@/lib/admin/services.functions";
import { SERVICE_ICON_NAMES, getServiceIcon } from "@/lib/admin/iconMap";
import { useConfirm } from "@/components/ConfirmDialogProvider";

export const Route = createFileRoute("/_authenticated/admin/services")({
  component: AdminServices,
});

const TYPE_LABELS: Record<ChecklistItemType, string> = {
  text: "Text answer",
  number: "Number",
  location: "Location (autosuggest)",
  checkbox: "Yes/No checkbox",
  document: "Document upload",
};

type Service = {
  id: string;
  icon: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  sort_order: number;
  active: boolean;
};

type FormState = {
  icon: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  sort_order: number;
  active: boolean;
};

const emptyForm: FormState = {
  icon: SERVICE_ICON_NAMES[0],
  title: "",
  description: "",
  checklist: [],
  sort_order: 0,
  active: true,
};

const SERVICE_SORT_OPTIONS = {
  sort_order: { label: "Sort order", cmp: (a: Service, b: Service) => a.sort_order - b.sort_order },
  title_asc: {
    label: "Title A-Z",
    cmp: (a: Service, b: Service) => a.title.localeCompare(b.title),
  },
} as const;
type ServiceSortKey = keyof typeof SERVICE_SORT_OPTIONS;

function AdminServices() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<ServiceSortKey>("sort_order");
  const [itemLabel, setItemLabel] = useState("");
  const [itemType, setItemType] = useState<ChecklistItemType>("text");
  const [itemUnit, setItemUnit] = useState("");
  const [itemRequired, setItemRequired] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const doCreate = useServerFn(createService);
  const doUpdate = useServerFn(updateService);
  const doDelete = useServerFn(deleteService);
  const confirm = useConfirm();

  function resetItemForm() {
    setItemLabel("");
    setItemType("text");
    setItemUnit("");
    setItemRequired(true);
    setEditingItemId(null);
  }

  function addOrUpdateChecklistItem() {
    const label = itemLabel.trim();
    if (!label) return;
    const unit = itemType === "number" ? itemUnit.trim() || undefined : undefined;
    if (editingItemId) {
      setForm((f) => ({
        ...f,
        checklist: f.checklist.map((c) =>
          c.id === editingItemId
            ? { id: editingItemId, label, type: itemType, unit, required: itemRequired }
            : c,
        ),
      }));
    } else {
      setForm((f) => ({
        ...f,
        checklist: [
          ...f.checklist,
          { id: crypto.randomUUID(), label, type: itemType, unit, required: itemRequired },
        ],
      }));
    }
    resetItemForm();
  }

  function editChecklistItem(item: ChecklistItem) {
    setEditingItemId(item.id);
    setItemLabel(item.label);
    setItemType(item.type);
    setItemUnit(item.unit ?? "");
    setItemRequired(item.required ?? true);
  }

  function removeChecklistItem(id: string) {
    setForm((f) => ({ ...f, checklist: f.checklist.filter((c) => c.id !== id) }));
    if (editingItemId === id) resetItemForm();
  }

  const { data: services, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw error;
      return data as unknown as Service[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    queryClient.invalidateQueries({ queryKey: ["public-services"] });
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setCreating(false);
    resetItemForm();
    setForm({
      icon: s.icon,
      title: s.title,
      description: s.description,
      checklist: s.checklist ?? [],
      sort_order: s.sort_order,
      active: s.active,
    });
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    resetItemForm();
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
    if (!(await confirm("Delete this service? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDelete({ data: { id } });
      toast.success("Service deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const searchLower = search.trim().toLowerCase();
  const filteredServices = (services ?? [])
    .filter((s) => {
      if (activeFilter === "active" && !s.active) return false;
      if (activeFilter === "inactive" && s.active) return false;
      if (!searchLower) return true;
      return [s.title, s.description]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(searchLower));
    })
    .sort(SERVICE_SORT_OPTIONS[sortKey].cmp);
  const hasActiveFilters = !!(search || activeFilter !== "all");

  const showForm = creating || editingId;

  function cancel() {
    setCreating(false);
    setEditingId(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown as cards in the "Our Services" section.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add service
        </button>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={cancel}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit service" : "New service"}
              </h2>
              <button
                onClick={cancel}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Icon
                </span>
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
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Sort order
                </span>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Title
                </span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Description
                </span>
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
              <div className="sm:col-span-2">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" /> Supporting documents checklist
                </span>
                <p className="mb-1.5 text-[11px] text-muted-foreground/70">
                  Shown to inquirers once they pick this service. Each item can ask a question,
                  request a document, or be a simple yes/no.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={itemLabel}
                    onChange={(e) => setItemLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOrUpdateChecklistItem();
                      }
                    }}
                    placeholder="e.g. Location of Lot"
                    className="h-10 min-w-[160px] flex-1 rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as ChecklistItemType)}
                    className="h-10 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {CHECKLIST_ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  {itemType === "number" && (
                    <input
                      value={itemUnit}
                      onChange={(e) => setItemUnit(e.target.value)}
                      placeholder="Unit (e.g. sqm)"
                      className="h-10 w-28 rounded-md border border-border bg-background px-2 text-sm"
                    />
                  )}
                  {itemType !== "checkbox" && itemType !== "document" && (
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={itemRequired}
                        onChange={(e) => setItemRequired(e.target.checked)}
                      />
                      Required
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={addOrUpdateChecklistItem}
                    className="rounded-md border border-border px-3 text-sm hover:bg-muted"
                  >
                    {editingItemId ? "Update" : "Add"}
                  </button>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={resetItemForm}
                      className="rounded-md border border-border px-3 text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {form.checklist.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {item.type}
                        </span>
                        <span className="min-w-0 flex-1">
                          {item.label}
                          {item.unit ? ` (${item.unit})` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => editChecklistItem(item)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${item.label}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(item.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${item.label}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={submit}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
              <button
                onClick={cancel}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description…"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as "all" | "active" | "inactive")}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="all">Active + inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as ServiceSortKey)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          {Object.entries(SERVICE_SORT_OPTIONS).map(([key, opt]) => (
            <option key={key} value={key}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveFilter("all");
            }}
            className="rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && services && services.length > 0 && filteredServices.length === 0 && (
        <p className="text-sm text-muted-foreground">No services match your search or filter.</p>
      )}

      <div className="grid max-h-[calc(100vh-320px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {filteredServices.map((s) => {
          const Icon = getServiceIcon(s.icon);
          return (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
            >
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
                {s.checklist?.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/70">
                    <ListChecks className="h-3.5 w-3.5" /> {s.checklist.length} checklist item
                    {s.checklist.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => startEdit(s)}
                  className="rounded-md p-2 hover:bg-muted"
                  aria-label="Edit"
                >
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
