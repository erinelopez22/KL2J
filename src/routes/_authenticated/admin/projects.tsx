import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateProject, deleteProject } from "@/lib/admin/projects.functions";
import {
  ProjectFormModal,
  AttachmentIcon,
  PROJECT_STATUSES,
  type ProjectRecord,
  type ProjectStatus,
} from "@/components/admin/ProjectFormModal";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: AdminProjects,
});

const STATUS_STYLES: Record<ProjectStatus, string> = {
  Created: "bg-muted text-muted-foreground",
  Attended: "bg-blue-100 text-blue-700",
  "On-hold": "bg-amber-100 text-amber-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-destructive/10 text-destructive",
};

function AdminProjects() {
  const queryClient = useQueryClient();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<"create" | ProjectRecord | null>(null);
  const [statusDraft, setStatusDraft] = useState<ProjectStatus | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const doUpdate = useServerFn(updateProject);
  const doDelete = useServerFn(deleteProject);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("sort_order", { ascending: false });
      if (error) throw error;
      return data as unknown as ProjectRecord[];
    },
  });

  const viewingProject = viewingId ? (projects?.find((p) => p.id === viewingId) ?? null) : null;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    queryClient.invalidateQueries({ queryKey: ["public-projects"] });
  }

  function openView(p: ProjectRecord) {
    setViewingId(p.id);
    setStatusDraft(p.status);
  }

  async function saveStatus(id: string, status: ProjectStatus) {
    setSavingStatus(true);
    try {
      await doUpdate({ data: { id, status } });
      toast.success(`Status set to ${status}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  async function remove(id: string) {
    try {
      await doDelete({ data: { id } });
      toast.success("Project deleted");
      setViewingId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Public portfolio / completed-work showcase. Only "Completed" projects show on the public site. Click a
            project to view or change its status; use Edit to update the rest of the record.
          </p>
        </div>
        <button
          onClick={() => setFormTarget("create")}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add project
        </button>
      </div>

      {viewingProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setViewingId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">{viewingProject.title}</h2>
              <button
                onClick={() => setViewingId(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {viewingProject.cover_photo_url && (
              <img
                src={viewingProject.cover_photo_url}
                alt={viewingProject.title}
                className="mb-4 aspect-video w-full rounded-lg object-cover"
              />
            )}

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Status</span>
              <div className="flex gap-2">
                <select
                  value={statusDraft ?? viewingProject.status}
                  onChange={(e) => setStatusDraft(e.target.value as ProjectStatus)}
                  className={`h-10 w-full rounded-md border border-border px-3 text-sm font-medium ${STATUS_STYLES[statusDraft ?? viewingProject.status]}`}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={savingStatus || (statusDraft ?? viewingProject.status) === viewingProject.status}
                  onClick={() => saveStatus(viewingProject.id, statusDraft ?? viewingProject.status)}
                  className="shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  {savingStatus ? "Saving…" : "Save"}
                </button>
              </div>
            </label>

            <div className="mt-4 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Location</span>
              <p className="mt-0.5">{viewingProject.location || "—"}</p>
            </div>
            <div className="mt-3 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Service</span>
              <p className="mt-0.5">{viewingProject.service || "—"}</p>
            </div>
            <div className="mt-3 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Dates</span>
              <p className="mt-0.5">
                {viewingProject.start_date
                  ? `${viewingProject.start_date}${viewingProject.end_date ? ` – ${viewingProject.end_date}` : ""}`
                  : "—"}
              </p>
            </div>
            <div className="mt-3 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">People involved</span>
              <p className="mt-0.5">
                {viewingProject.personnel?.length > 0 ? viewingProject.personnel.join(", ") : "—"}
              </p>
            </div>
            <div className="mt-3 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Description</span>
              <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{viewingProject.description || "—"}</p>
            </div>
            {viewingProject.attachments?.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Files</span>
                <div className="mt-1.5 space-y-1.5">
                  {viewingProject.attachments.map((a) => (
                    <a
                      key={a.path}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                    >
                      <AttachmentIcon type={a.type} />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={() => {
                  setFormTarget(viewingProject);
                  setViewingId(null);
                }}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button
                onClick={() => setViewingId(null)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={() => remove(viewingProject.id)}
                className="ml-auto flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Delete project
              </button>
            </div>
          </div>
        </div>
      )}

      {formTarget && (
        <ProjectFormModal
          project={formTarget === "create" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            const wasEditing = formTarget !== "create";
            const id = wasEditing ? (formTarget as ProjectRecord).id : null;
            setFormTarget(null);
            refresh();
            if (id) setViewingId(id);
          }}
          onDeleted={() => {
            setFormTarget(null);
            refresh();
          }}
        />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {projects?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openView(p)}
            className="flex gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm"
          >
            {p.cover_photo_url && (
              <img src={p.cover_photo_url} alt={p.title} className="h-16 w-16 shrink-0 rounded-md object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[p.status]}`}>
                  {p.status}
                </span>
              </div>
              {p.location && <div className="text-xs text-muted-foreground">{p.location}</div>}
              <div className="text-xs text-muted-foreground">
                {p.service}
                {p.start_date ? ` · ${p.start_date}${p.end_date ? ` – ${p.end_date}` : ""}` : ""}
              </div>
              {p.personnel?.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">Team: {p.personnel.join(", ")}</div>
              )}
              {p.attachments?.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.attachments.length} file{p.attachments.length === 1 ? "" : "s"} attached
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
