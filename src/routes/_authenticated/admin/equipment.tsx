import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Search, FileText, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createEquipment, updateEquipment, deleteEquipment } from "@/lib/admin/equipment.functions";
import { deleteSiteMedia } from "@/lib/admin/media.functions";
import { SERVICE_ICON_NAMES, getServiceIcon } from "@/lib/admin/iconMap";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { FileDrop } from "@/components/admin/FileDrop";
import { AttachmentLightbox, type LightboxItem } from "@/components/AttachmentLightbox";

export const Route = createFileRoute("/_authenticated/admin/equipment")({
  component: AdminEquipment,
});

export type EquipmentMediaItem = {
  url: string;
  path?: string;
  contentType: string;
  kind: "image" | "video" | "document";
  name: string;
  isExternalLink?: boolean;
};

type Equipment = {
  id: string;
  icon: string;
  title: string;
  description: string;
  sort_order: number;
  active: boolean;
  media: EquipmentMediaItem[];
};

type FormState = {
  icon: string;
  title: string;
  description: string;
  sort_order: number;
  active: boolean;
  media: EquipmentMediaItem[];
};

const emptyForm: FormState = {
  icon: SERVICE_ICON_NAMES[0],
  title: "",
  description: "",
  sort_order: 0,
  active: true,
  media: [],
};

function kindFromMediaContentType(contentType: string): EquipmentMediaItem["kind"] {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

const EQUIPMENT_SORT_OPTIONS = {
  sort_order: { label: "Sort order", cmp: (a: Equipment, b: Equipment) => a.sort_order - b.sort_order },
  title_asc: {
    label: "Title A-Z",
    cmp: (a: Equipment, b: Equipment) => a.title.localeCompare(b.title),
  },
} as const;
type EquipmentSortKey = keyof typeof EQUIPMENT_SORT_OPTIONS;

function AdminEquipment() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<EquipmentSortKey>("sort_order");
  const doCreate = useServerFn(createEquipment);
  const doUpdate = useServerFn(updateEquipment);
  const doDelete = useServerFn(deleteEquipment);
  const doDeleteMedia = useServerFn(deleteSiteMedia);
  const confirm = useConfirm();
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["admin-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("sort_order");
      if (error) throw error;
      return data as unknown as Equipment[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-equipment"] });
    queryClient.invalidateQueries({ queryKey: ["public-equipment"] });
  }

  function startEdit(e: Equipment) {
    setEditingId(e.id);
    setCreating(false);
    setForm({
      icon: e.icon,
      title: e.title,
      description: e.description,
      sort_order: e.sort_order,
      active: e.active,
      media: e.media ?? [],
    });
  }

  async function removeMedia(item: EquipmentMediaItem) {
    setForm((f) => ({ ...f, media: f.media.filter((m) => m.url !== item.url) }));
    if (item.isExternalLink || !item.path) return;
    try {
      await doDeleteMedia({ data: { path: item.path } });
    } catch (err) {
      console.error(err);
    }
  }

  function openMediaLightbox(list: EquipmentMediaItem[], startIndex: number) {
    const items: LightboxItem[] = list.map((m) => ({
      name: m.name,
      kind: m.isExternalLink ? "external" : m.kind,
      resolveUrl: () => m.url,
    }));
    setLightbox({ items, index: startIndex });
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: (equipment?.length ?? 0) + 1 });
  }

  async function submit() {
    try {
      if (editingId) {
        await doUpdate({ data: { id: editingId, ...form } });
        toast.success("Equipment updated");
      } else {
        await doCreate({ data: form });
        toast.success("Equipment added");
      }
      setEditingId(null);
      setCreating(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function remove(id: string) {
    if (!(await confirm("Delete this equipment? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDelete({ data: { id } });
      toast.success("Equipment deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const searchLower = search.trim().toLowerCase();
  const filteredEquipment = (equipment ?? [])
    .filter((e) => {
      if (activeFilter === "active" && !e.active) return false;
      if (activeFilter === "inactive" && e.active) return false;
      if (!searchLower) return true;
      return [e.title, e.description]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(searchLower));
    })
    .sort(EQUIPMENT_SORT_OPTIONS[sortKey].cmp);
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
          <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown in the "Our Equipment" section on the public homepage.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add equipment
        </button>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={cancel}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit equipment" : "New equipment"}
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
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Title
                </span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. GNSS/RTK Receiver"
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
                  placeholder="e.g. Centimeter-accurate positioning for boundary and topographic surveys."
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
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Photos, videos & documents
                </span>
                <p className="mb-2 text-[11px] text-muted-foreground/70">
                  Shown to visitors when they click this instrument on the public site.
                </p>
                {form.media.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {form.media.map((m, i) => (
                      <div
                        key={m.url}
                        className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                      >
                        <button
                          type="button"
                          onClick={() => openMediaLightbox(form.media, i)}
                          className="block h-full w-full"
                        >
                          {m.kind === "image" ? (
                            <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                          ) : m.kind === "video" ? (
                            <>
                              <video
                                src={m.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
                                  <Play className="h-3 w-3 fill-slate-900 text-slate-900" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <span className="w-full truncate text-[9px] text-muted-foreground">
                                {m.name}
                              </span>
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMedia(m)}
                          className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                          aria-label={`Remove ${m.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="max-w-sm">
                  <FileDrop
                    folder="equipment"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf"
                    label="Upload a photo, video, or document"
                    onUploaded={(result) =>
                      setForm((f) => ({
                        ...f,
                        media: [
                          ...f.media,
                          {
                            url: result.url,
                            path: result.path,
                            contentType: result.contentType,
                            kind: kindFromMediaContentType(result.contentType),
                            name: result.name,
                            isExternalLink: result.isExternalLink,
                          },
                        ],
                      }))
                    }
                  />
                </div>
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
          onChange={(e) => setSortKey(e.target.value as EquipmentSortKey)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          {Object.entries(EQUIPMENT_SORT_OPTIONS).map(([key, opt]) => (
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
      {!isLoading && equipment && equipment.length > 0 && filteredEquipment.length === 0 && (
        <p className="text-sm text-muted-foreground">No equipment matches your search or filter.</p>
      )}
      {!isLoading && equipment && equipment.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No equipment yet. Add your first item to show it on the public site.
        </p>
      )}

      <div className="grid max-h-[calc(100vh-320px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {filteredEquipment.map((e) => {
          const Icon = getServiceIcon(e.icon);
          return (
            <div
              key={e.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.title}</span>
                  {!e.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => startEdit(e)}
                  className="rounded-md p-2 hover:bg-muted"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(e.id)}
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
      {lightbox && (
        <AttachmentLightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
