import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Trash2, FileText, Video, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createProject, updateProject, deleteProject } from "@/lib/admin/projects.functions";
import { deleteSiteMedia } from "@/lib/admin/media.functions";
import { usePublicServices } from "@/lib/public-content";
import { FileDrop } from "@/components/admin/FileDrop";
import { LocationAutosuggest } from "@/components/admin/LocationAutosuggest";

export const PROJECT_STATUSES = ["Created", "Attended", "On-hold", "Completed", "Cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectAttachment = { url: string; path: string; type: "image" | "video" | "document"; name: string };

export type ProjectRecord = {
  id: string;
  title: string;
  location: string;
  description: string | null;
  service: string | null;
  start_date: string | null;
  end_date: string | null;
  personnel: string[];
  cover_photo_url: string | null;
  attachments: ProjectAttachment[];
  status: ProjectStatus;
  inquiry_id: string | null;
  sort_order: number;
};

type FormState = {
  title: string;
  location: string;
  description: string;
  service: string;
  start_date: string;
  end_date: string;
  personnel: string[];
  cover_photo_url: string;
  attachments: ProjectAttachment[];
  status: ProjectStatus;
  inquiry_id: string;
};

function attachmentTypeFor(contentType: string): ProjectAttachment["type"] {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

export function AttachmentIcon({ type }: { type: ProjectAttachment["type"] }) {
  if (type === "image") return <ImageIcon className="h-4 w-4" />;
  if (type === "video") return <Video className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function emptyForm(): FormState {
  return {
    title: "",
    location: "",
    description: "",
    service: "",
    start_date: "",
    end_date: "",
    personnel: [],
    cover_photo_url: "",
    attachments: [],
    status: "Created",
    inquiry_id: "",
  };
}

export function ProjectFormModal({
  project,
  defaultInquiry,
  onClose,
  onSaved,
  onDeleted,
}: {
  project: ProjectRecord | null;
  defaultInquiry?: { id: string; label: string };
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    project
      ? {
          title: project.title,
          location: project.location ?? "",
          description: project.description ?? "",
          service: project.service ?? "",
          start_date: project.start_date ?? "",
          end_date: project.end_date ?? "",
          personnel: project.personnel ?? [],
          cover_photo_url: project.cover_photo_url ?? "",
          attachments: project.attachments ?? [],
          status: project.status,
          inquiry_id: project.inquiry_id ?? "",
        }
      : emptyForm(),
  );
  const [personName, setPersonName] = useState("");
  const [saving, setSaving] = useState(false);
  const doCreate = useServerFn(createProject);
  const doUpdate = useServerFn(updateProject);
  const doDelete = useServerFn(deleteProject);
  const doDeleteMedia = useServerFn(deleteSiteMedia);
  const { data: services } = usePublicServices();

  const { data: inquiries } = useQuery({
    queryKey: ["admin-inquiries-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select("id, name, contact, service, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as { id: string; name: string; contact: string; service: string | null; created_at: string }[];
    },
    enabled: !defaultInquiry,
  });

  const requiredInquiryMissing = !project && !defaultInquiry && !form.inquiry_id;

  function addAttachment(result: { url: string; path: string; contentType: string; name: string }) {
    setForm((f) => ({
      ...f,
      attachments: [
        ...f.attachments,
        { url: result.url, path: result.path, type: attachmentTypeFor(result.contentType), name: result.name },
      ],
    }));
  }

  async function removeAttachment(attachment: ProjectAttachment) {
    setForm((f) => ({ ...f, attachments: f.attachments.filter((a) => a.path !== attachment.path) }));
    try {
      await doDeleteMedia({ data: { path: attachment.path } });
    } catch (err) {
      console.error(err);
    }
  }

  function addPerson() {
    const name = personName.trim();
    if (!name) return;
    setForm({ ...form, personnel: [...form.personnel, name] });
    setPersonName("");
  }

  function removePerson(name: string) {
    setForm({ ...form, personnel: form.personnel.filter((p) => p !== name) });
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.location.trim()) {
      toast.error("Location is required");
      return;
    }
    if (requiredInquiryMissing) {
      toast.error("Every project must be linked to an inquiry — select one first");
      return;
    }
    const payload = {
      title: form.title.trim(),
      location: form.location.trim(),
      description: form.description.trim() || undefined,
      service: form.service || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      personnel: form.personnel,
      cover_photo_url: form.cover_photo_url || undefined,
      attachments: form.attachments,
      status: form.status,
      inquiry_id: defaultInquiry?.id || form.inquiry_id || undefined,
      sort_order: project?.sort_order ?? 0,
    };
    setSaving(true);
    try {
      if (project) {
        await doUpdate({ data: { id: project.id, ...payload } });
        toast.success("Project updated");
      } else {
        await doCreate({ data: payload });
        toast.success("Project created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    try {
      await doDelete({ data: { id: project.id } });
      toast.success("Project deleted");
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{project ? "Edit project" : "New project"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-10">
          {defaultInquiry ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Linked inquiry</span>
              <p className="mt-0.5 font-medium">{defaultInquiry.label}</p>
            </div>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Linked inquiry {!project && <span className="text-destructive">(required)</span>}
              </span>
              <select
                value={form.inquiry_id}
                onChange={(e) => setForm({ ...form, inquiry_id: e.target.value })}
                className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${
                  requiredInquiryMissing ? "border-destructive" : "border-border"
                }`}
              >
                <option value="">— Select an inquiry —</option>
                {inquiries?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.contact}
                    {i.service ? ` · ${i.service}` : ""}
                  </option>
                ))}
              </select>
              {requiredInquiryMissing && (
                <p className="mt-1 text-xs text-destructive">
                  Projects are always created from an inquiry — pick which one this belongs to.
                </p>
              )}
            </label>
          )}

          <section>
            <h3 className="mb-5 border-b border-border pb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Project details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Location <span className="text-destructive">(required)</span>
                </span>
                <LocationAutosuggest value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Service</span>
                <select
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Select a service</option>
                  {services?.map((s) => (
                    <option key={s.id} value={s.title}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              {project && (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Start date</span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">End date</span>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
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
            </div>
          </section>

          <section>
            <h3 className="mb-5 border-b border-border pb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              People involved
            </h3>
            <div className="flex gap-2">
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPerson();
                  }
                }}
                placeholder="Name"
                className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
              />
              <button
                type="button"
                onClick={addPerson}
                className="rounded-md border border-border px-3 text-sm hover:bg-muted"
              >
                Add
              </button>
            </div>
            {form.personnel.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.personnel.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                    {name}
                    <button type="button" onClick={() => removePerson(name)} aria-label={`Remove ${name}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-5 border-b border-border pb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Media & attachments
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Cover photo</span>
                {form.cover_photo_url && (
                  <img src={form.cover_photo_url} alt="Cover" className="mb-2 h-32 w-full rounded-lg object-cover" />
                )}
                <FileDrop
                  folder="projects"
                  label="Upload cover photo"
                  onUploaded={(result) => setForm({ ...form, cover_photo_url: result.url })}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Files (photos, documents, videos)
                </span>
                <FileDrop
                  folder="projects"
                  accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
                  label="Upload a photo, document, or video"
                  onUploaded={addAttachment}
                />
                {form.attachments.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.attachments.map((a) => (
                      <div
                        key={a.path}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <AttachmentIcon type={a.type} />
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${a.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={submit}
            disabled={saving || requiredInquiryMissing}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
          {project && (
            <button
              onClick={handleDelete}
              className="ml-auto flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Delete project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
