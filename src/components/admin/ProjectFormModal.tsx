import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Trash2, FileText, Video, Image as ImageIcon, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createProject, updateProject, deleteProject } from "@/lib/admin/projects.functions";
import { deleteSiteMedia, deleteConfidentialMedia, getConfidentialFileUrl } from "@/lib/admin/media.functions";
import { FileDrop } from "@/components/admin/FileDrop";
import { ConfidentialFileDrop } from "@/components/admin/ConfidentialFileDrop";
import { LocationAutosuggest } from "@/components/LocationAutosuggest";
import { useConfirm } from "@/components/ConfirmDialogProvider";

export type ProjectAttachment = {
  url: string;
  path: string;
  type: "image" | "video" | "document";
  name: string;
  description?: string;
};
export type ConfidentialAttachment = {
  path: string;
  type: "image" | "video" | "document";
  name: string;
  description?: string;
};

export type InquiryChecklistItem = {
  type: string;
  answer?: string;
  documents?: { path: string; name: string; contentType: string }[];
};

export type DefaultInquiry = {
  id: string;
  label: string;
  name: string;
  service: string | null;
  checklist_responses: InquiryChecklistItem[];
};

function defaultTitleFromInquiry(name: string, service: string | null | undefined): string {
  return service ? `${service} - ${name}` : name;
}

function defaultLocationFromInquiry(checklistResponses: InquiryChecklistItem[] | undefined): string {
  return checklistResponses?.find((c) => c.type === "location")?.answer?.trim() ?? "";
}

export function inquiryDocumentsFrom(
  checklistResponses: InquiryChecklistItem[] | undefined,
): { path: string; name: string; contentType: string }[] {
  return checklistResponses?.filter((c) => c.type === "document").flatMap((c) => c.documents ?? []) ?? [];
}

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
  confidential_attachments: ConfidentialAttachment[];
  is_public: boolean;
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
  confidential_attachments: ConfidentialAttachment[];
  is_public: boolean;
  inquiry_id: string;
};

export function attachmentTypeFor(contentType: string): ProjectAttachment["type"] {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

function AttachmentRow({
  attachment,
  href,
  variant,
  onDescriptionChange,
  onRemove,
}: {
  attachment: { path: string; name: string; type: ProjectAttachment["type"]; description?: string };
  href?: string;
  variant: "public" | "confidential";
  onDescriptionChange: (description: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2 ${
        variant === "confidential" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-background"
      }`}
    >
      <AttachmentIcon type={attachment.type} />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={attachment.name}
          className="w-32 shrink-0 truncate text-xs font-medium hover:underline"
        >
          {attachment.name}
        </a>
      ) : (
        <span className="w-32 shrink-0 truncate text-xs font-medium" title={attachment.name}>
          {attachment.name}
        </span>
      )}
      <input
        value={attachment.description ?? ""}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Description (optional)"
        className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
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
    confidential_attachments: [],
    is_public: false,
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
  defaultInquiry?: DefaultInquiry;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (project) {
      return {
        title: project.title,
        location: project.location ?? "",
        description: project.description ?? "",
        service: project.service ?? "",
        start_date: project.start_date ?? "",
        end_date: project.end_date ?? "",
        personnel: project.personnel ?? [],
        cover_photo_url: project.cover_photo_url ?? "",
        attachments: project.attachments ?? [],
        confidential_attachments: project.confidential_attachments ?? [],
        is_public: project.is_public ?? false,
        inquiry_id: project.inquiry_id ?? "",
      };
    }
    const base = emptyForm();
    if (defaultInquiry) {
      base.title = defaultTitleFromInquiry(defaultInquiry.name, defaultInquiry.service);
      base.location = defaultLocationFromInquiry(defaultInquiry.checklist_responses);
      base.inquiry_id = defaultInquiry.id;
    }
    return base;
  });
  const [mediaTab, setMediaTab] = useState<"public" | "confidential">("public");
  const [personName, setPersonName] = useState("");
  const [saving, setSaving] = useState(false);
  const doCreate = useServerFn(createProject);
  const doUpdate = useServerFn(updateProject);
  const doDelete = useServerFn(deleteProject);
  const doDeleteMedia = useServerFn(deleteSiteMedia);
  const doDeleteConfidential = useServerFn(deleteConfidentialMedia);
  const confirm = useConfirm();
  const { data: inquiries } = useQuery({
    queryKey: ["admin-inquiries-picker", project?.inquiry_id],
    queryFn: async () => {
      const [inquiriesRes, linkedRes] = await Promise.all([
        supabase
          .from("inquiries")
          .select("id, name, contact, service, created_at, checklist_responses")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("projects").select("inquiry_id").not("inquiry_id", "is", null),
      ]);
      if (inquiriesRes.error) throw inquiriesRes.error;
      if (linkedRes.error) throw linkedRes.error;
      const linkedIds = new Set(
        linkedRes.data.map((p) => p.inquiry_id).filter((id) => id !== null && id !== project?.inquiry_id),
      );
      return inquiriesRes.data.filter((i) => !linkedIds.has(i.id)) as {
        id: string;
        name: string;
        contact: string;
        service: string | null;
        created_at: string;
        checklist_responses: InquiryChecklistItem[];
      }[];
    },
    enabled: !defaultInquiry,
  });

  function selectInquiry(id: string) {
    const inquiry = inquiries?.find((i) => i.id === id);
    setForm((f) => ({
      ...f,
      inquiry_id: id,
      title: (!project || !f.title.trim()) && inquiry ? defaultTitleFromInquiry(inquiry.name, inquiry.service) : f.title,
      location:
        (!project || !f.location.trim()) && inquiry
          ? defaultLocationFromInquiry(inquiry.checklist_responses)
          : f.location,
    }));
  }

  const selectedInquiryChecklist =
    defaultInquiry?.checklist_responses ?? inquiries?.find((i) => i.id === form.inquiry_id)?.checklist_responses;
  const inquiryDocuments = inquiryDocumentsFrom(selectedInquiryChecklist);
  const doGetConfidentialUrl = useServerFn(getConfidentialFileUrl);

  async function openInquiryDocument(doc: { path: string; name: string }) {
    try {
      const { url } = await doGetConfidentialUrl({ data: { path: doc.path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open file");
    }
  }

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
    if (!(await confirm("Remove this file? This cannot be undone.", { destructive: true }))) return;
    setForm((f) => ({ ...f, attachments: f.attachments.filter((a) => a.path !== attachment.path) }));
    try {
      await doDeleteMedia({ data: { path: attachment.path } });
    } catch (err) {
      console.error(err);
    }
  }

  function addConfidentialAttachment(result: { path: string; contentType: string; name: string }) {
    setForm((f) => ({
      ...f,
      confidential_attachments: [
        ...f.confidential_attachments,
        { path: result.path, type: attachmentTypeFor(result.contentType), name: result.name },
      ],
    }));
  }

  async function removeConfidentialAttachment(attachment: ConfidentialAttachment) {
    if (!(await confirm("Remove this file? This cannot be undone.", { destructive: true }))) return;
    setForm((f) => ({
      ...f,
      confidential_attachments: f.confidential_attachments.filter((a) => a.path !== attachment.path),
    }));
    try {
      await doDeleteConfidential({ data: { path: attachment.path } });
    } catch (err) {
      console.error(err);
    }
  }

  function updateAttachmentDescription(path: string, description: string) {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.map((a) => (a.path === path ? { ...a, description } : a)),
    }));
  }

  function updateConfidentialAttachmentDescription(path: string, description: string) {
    setForm((f) => ({
      ...f,
      confidential_attachments: f.confidential_attachments.map((a) =>
        a.path === path ? { ...a, description } : a,
      ),
    }));
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
      confidential_attachments: form.confidential_attachments,
      is_public: form.is_public,
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
    if (!(await confirm("Delete this project? This cannot be undone.", { destructive: true }))) return;
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
                onChange={(e) => selectInquiry(e.target.value)}
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
            <h3 className="mb-5 border-b-2 border-primary/30 pb-2.5 text-sm font-bold uppercase tracking-wide text-foreground">
              Project details
            </h3>
            <div className="grid gap-3 pl-4 sm:grid-cols-2">
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
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_public}
                  onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-xs font-semibold uppercase text-muted-foreground">Show on public site</span>
              </label>
              <div className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Date range</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="Start date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <span className="shrink-0 text-muted-foreground">–</span>
                  <input
                    type="date"
                    aria-label="End date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                </div>
              </div>
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
            <h3 className="mb-5 border-b-2 border-primary/30 pb-2.5 text-sm font-bold uppercase tracking-wide text-foreground">
              People involved
            </h3>
            <div className="pl-4">
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
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                    >
                      {name}
                      <button type="button" onClick={() => removePerson(name)} aria-label={`Remove ${name}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-5 border-b-2 border-primary/30 pb-2.5 text-sm font-bold uppercase tracking-wide text-foreground">
              Media & attachments
            </h3>
            <div className="pl-4">
              <div className="flex gap-1 border-b border-border">
                <button
                  type="button"
                  onClick={() => setMediaTab("public")}
                  className={`border-b-2 px-3 py-2 text-sm font-medium ${
                    mediaTab === "public"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Public files
                </button>
                <button
                  type="button"
                  onClick={() => setMediaTab("confidential")}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
                    mediaTab === "confidential"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" /> Confidential files
                </button>
              </div>

              {mediaTab === "public" ? (
                <div className="pt-3">
                  <p className="mb-1.5 text-[11px] text-muted-foreground/70">Visible to visitors on the public site.</p>
                  <FileDrop
                    folder="projects"
                    accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
                    label="Upload a photo, document, or video"
                    onUploaded={addAttachment}
                  />
                  {form.attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {form.attachments.map((a) => (
                        <AttachmentRow
                          key={a.path}
                          attachment={a}
                          href={a.url}
                          variant="public"
                          onDescriptionChange={(description) => updateAttachmentDescription(a.path, description)}
                          onRemove={() => removeAttachment(a)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-3">
                  <p className="mb-1.5 text-[11px] text-muted-foreground/70">
                    Only visible to admins here — never shown on the public site.
                  </p>
                  <ConfidentialFileDrop onUploaded={addConfidentialAttachment} />
                  {form.confidential_attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {form.confidential_attachments.map((a) => (
                        <AttachmentRow
                          key={a.path}
                          attachment={a}
                          variant="confidential"
                          onDescriptionChange={(description) =>
                            updateConfidentialAttachmentDescription(a.path, description)
                          }
                          onRemove={() => removeConfidentialAttachment(a)}
                        />
                      ))}
                    </div>
                  )}
                  {inquiryDocuments.length > 0 && (
                    <div className="mt-4">
                      <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                        From linked inquiry
                      </span>
                      <div className="space-y-1.5">
                        {inquiryDocuments.map((doc) => (
                          <button
                            key={doc.path}
                            type="button"
                            onClick={() => openInquiryDocument(doc)}
                            className="flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-left text-sm hover:bg-amber-500/10"
                          >
                            <AttachmentIcon type={attachmentTypeFor(doc.contentType)} />
                            <span className="min-w-0 flex-1 truncate font-medium">{doc.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
