import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Trash2,
  X,
  Pencil,
  Lock,
  ChevronDown,
  CheckCircle2,
  Circle,
  FileText,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteProject, updateProject } from "@/lib/admin/projects.functions";
import { getConfidentialFileUrl } from "@/lib/admin/media.functions";
import {
  ProjectFormModal,
  AttachmentIcon,
  attachmentTypeFor,
  inquiryDocumentsFrom,
  type AttachmentKind,
  type ProjectAttachment,
  type ProjectRecord,
} from "@/components/admin/ProjectFormModal";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import {
  AttachmentLightbox,
  kindFromContentType,
  type LightboxItem,
} from "@/components/AttachmentLightbox";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: AdminProjects,
});

type LinkedInquiryChecklistResponse = {
  id: string;
  label: string;
  type: string;
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: { path: string; name: string; contentType: string; isExternalLink?: boolean }[];
};

type LinkedInquiry = {
  id: string;
  created_at: string;
  name: string;
  contact: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  message: string | null;
  channel: string | null;
  checklist_responses: LinkedInquiryChecklistResponse[];
};

function platformLabel(channel: string | null): string {
  if (channel === "quote_form") return "Request a Quote form";
  if (channel) return "Chatbot";
  return "Unknown";
}

function PublicToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      aria-pressed={checked}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium uppercase transition-colors ${
        checked ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      Public
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[45%_1fr] items-start gap-3 px-3 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function MediaThumb({ type, url }: { type: AttachmentKind; url?: string }) {
  if (type === "image" && url) {
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }
  if (type === "video" && url) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
      <AttachmentIcon type={type} />
    </div>
  );
}

function ConfidentialThumb({
  path,
  type,
  getUrl,
}: {
  path: string;
  type: AttachmentKind;
  getUrl: (path: string) => Promise<string>;
}) {
  const { data: url } = useQuery({
    queryKey: ["confidential-thumb", path],
    queryFn: () => getUrl(path),
    enabled: type === "image" || type === "video",
    staleTime: 4 * 60 * 1000,
  });
  return <MediaThumb type={type} url={url} />;
}

// Read-only summary of a project's photos/videos (gallery_photos, joined via
// its linked folder) — editing happens in ProjectFormModal's Photos &
// videos tab, or in /admin/gallery directly.
function ProjectMediaGrid({ projectId }: { projectId: string }) {
  const { data: folder } = useQuery({
    queryKey: ["project-gallery-folder", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_folders")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const folderId = folder?.id ?? null;

  const { data: photos } = useQuery({
    queryKey: ["project-gallery-photos", folderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("id, url, caption, media_type")
        .eq("folder_id", folderId as string)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!folderId,
  });

  if (!photos || photos.length === 0) {
    return <p className="text-sm text-muted-foreground/70">No photos or videos.</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-2">
      {photos.map((p) => (
        <div
          key={p.id}
          className="aspect-square overflow-hidden rounded-md border border-border bg-muted"
        >
          {p.media_type === "video" ? (
            <video src={p.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          ) : (
            <img src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" />
          )}
        </div>
      ))}
    </div>
  );
}

const PROJECT_SORT_OPTIONS = {
  newest: {
    label: "Newest first",
    cmp: (a: ProjectRecord, b: ProjectRecord) => b.sort_order - a.sort_order,
  },
  oldest: {
    label: "Oldest first",
    cmp: (a: ProjectRecord, b: ProjectRecord) => a.sort_order - b.sort_order,
  },
  title_asc: {
    label: "Title A-Z",
    cmp: (a: ProjectRecord, b: ProjectRecord) => a.title.localeCompare(b.title),
  },
} as const;
type ProjectSortKey = keyof typeof PROJECT_SORT_OPTIONS;

function AdminProjects() {
  const queryClient = useQueryClient();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<"create" | ProjectRecord | null>(null);
  const [viewMediaTab, setViewMediaTab] = useState<"public" | "photos" | "confidential">("public");
  const [inquiryAccordionOpen, setInquiryAccordionOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [sortKey, setSortKey] = useState<ProjectSortKey>("newest");
  const doDelete = useServerFn(deleteProject);
  const confirm = useConfirm();
  const doUpdate = useServerFn(updateProject);
  const doGetConfidentialUrl = useServerFn(getConfidentialFileUrl);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("sort_order", { ascending: false });
      if (error) throw error;
      return data as unknown as ProjectRecord[];
    },
  });

  const viewingProject = viewingId ? (projects?.find((p) => p.id === viewingId) ?? null) : null;

  const { data: linkedInquiry } = useQuery({
    queryKey: ["project-linked-inquiry", viewingProject?.inquiry_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select(
          "id, created_at, name, contact, email, phone, service, message, channel, checklist_responses",
        )
        .eq("id", viewingProject!.inquiry_id!)
        .single();
      if (error) throw error;
      return data as LinkedInquiry;
    },
    enabled: !!viewingProject?.inquiry_id,
  });
  const inquiryDocuments = inquiryDocumentsFrom(linkedInquiry?.checklist_responses);

  async function fetchConfidentialUrl(path: string): Promise<string> {
    const { url } = await doGetConfidentialUrl({ data: { path } });
    return url;
  }

  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  function openPublicAttachments(
    docs: {
      url: string;
      name: string;
      type: ProjectAttachment["type"];
      isExternalLink?: boolean;
    }[],
    startIndex: number,
  ) {
    const items: LightboxItem[] = docs.map((d) => ({
      name: d.name,
      kind: d.isExternalLink ? "external" : d.type,
      resolveUrl: () => d.url,
    }));
    setLightbox({ items, index: startIndex });
  }

  function openConfidentialAttachments(
    docs: {
      path: string;
      name: string;
      contentType?: string;
      type?: AttachmentKind;
      isExternalLink?: boolean;
    }[],
    startIndex: number,
  ) {
    const items: LightboxItem[] = docs.map((d) => ({
      name: d.name,
      kind: d.isExternalLink
        ? "external"
        : (d.type ?? kindFromContentType(d.contentType ?? "", d.isExternalLink)),
      resolveUrl: () =>
        d.isExternalLink
          ? d.path
          : doGetConfidentialUrl({ data: { path: d.path } }).then((r) => r.url),
    }));
    setLightbox({ items, index: startIndex });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    queryClient.invalidateQueries({ queryKey: ["public-projects"] });
  }

  function openView(p: ProjectRecord) {
    setViewingId(p.id);
    setViewMediaTab("public");
    setInquiryAccordionOpen(false);
  }

  async function remove(id: string) {
    if (!(await confirm("Delete this project? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDelete({ data: { id } });
      toast.success("Project deleted");
      setViewingId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const serviceOptions = Array.from(
    new Set((projects ?? []).map((p) => p.service).filter((s): s is string => Boolean(s))),
  ).sort();
  const searchLower = search.trim().toLowerCase();
  const filteredProjects = (projects ?? [])
    .filter((p) => {
      if (serviceFilter && p.service !== serviceFilter) return false;
      if (visibilityFilter === "public" && !p.is_public) return false;
      if (visibilityFilter === "private" && p.is_public) return false;
      if (!searchLower) return true;
      return [p.title, p.location, p.service, ...(p.personnel ?? [])]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(searchLower));
    })
    .sort(PROJECT_SORT_OPTIONS[sortKey].cmp);
  const hasActiveFilters = !!(search || serviceFilter || visibilityFilter !== "all");

  async function togglePublic(p: ProjectRecord) {
    try {
      await doUpdate({ data: { id: p.id, is_public: !p.is_public } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reference and documentation for inquiries. Toggle "Show on public site" on a project to
            include it in the public portfolio.
          </p>
        </div>
        <button
          onClick={() => setFormTarget("create")}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add project
        </button>
      </div>

      {viewingProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setViewingId(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold leading-tight">{viewingProject.title}</h2>
                {viewingProject.location && (
                  <p className="mt-0.5 text-sm text-foreground/80">{viewingProject.location}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PublicToggle
                  checked={viewingProject.is_public}
                  onChange={() => togglePublic(viewingProject)}
                />
                <button
                  onClick={() => setViewingId(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {linkedInquiry && (
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Linked inquiry
                </span>
                <p className="mt-0.5 font-medium">
                  {linkedInquiry.name} · {linkedInquiry.contact}
                </p>
              </div>
            )}

            {viewingProject.cover_photo_url && (
              <img
                src={viewingProject.cover_photo_url}
                alt={viewingProject.title}
                className="mt-4 aspect-video w-full rounded-lg object-cover"
              />
            )}

            <section className="mt-5">
              <h3 className="mb-3 border-b-2 border-primary/30 pb-2 text-sm font-bold uppercase tracking-wide text-foreground">
                Project details
              </h3>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                <DetailRow label="Project Name">{viewingProject.title}</DetailRow>
                <DetailRow label="Project Type">{linkedInquiry?.service || "—"}</DetailRow>
                <DetailRow label="Project Date">
                  {viewingProject.start_date
                    ? `${viewingProject.start_date}${viewingProject.end_date ? ` – ${viewingProject.end_date}` : ""}`
                    : "—"}
                </DetailRow>
                <DetailRow label="Project Details">
                  <span className="whitespace-pre-wrap leading-relaxed">
                    {viewingProject.description || "No description yet."}
                  </span>
                </DetailRow>
              </div>
            </section>

            <section className="mt-5">
              <h3 className="mb-3 border-b-2 border-primary/30 pb-2 text-sm font-bold uppercase tracking-wide text-foreground">
                People involved
              </h3>
              {viewingProject.personnel?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {viewingProject.personnel.map((name) => (
                    <span key={name} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/70">No one added yet.</p>
              )}
            </section>

            <section className="mt-5">
              <h3 className="mb-3 border-b-2 border-primary/30 pb-2 text-sm font-bold uppercase tracking-wide text-foreground">
                Media & attachments
              </h3>
              <div className="flex gap-1 border-b border-border">
                <button
                  type="button"
                  onClick={() => setViewMediaTab("public")}
                  className={`border-b-2 px-3 py-2 text-sm font-medium ${
                    viewMediaTab === "public"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Documents
                </button>
                <button
                  type="button"
                  onClick={() => setViewMediaTab("photos")}
                  className={`border-b-2 px-3 py-2 text-sm font-medium ${
                    viewMediaTab === "photos"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Photos &amp; videos
                </button>
                <button
                  type="button"
                  onClick={() => setViewMediaTab("confidential")}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
                    viewMediaTab === "confidential"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" /> Confidential files
                </button>
              </div>

              {viewMediaTab === "public" ? (
                <div className="pt-3">
                  {viewingProject.attachments?.length > 0 ? (
                    <div className="space-y-1.5">
                      {viewingProject.attachments.map((a, i) => (
                        <button
                          key={a.path}
                          type="button"
                          onClick={() => openPublicAttachments(viewingProject.attachments, i)}
                          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background p-2 text-left text-sm hover:bg-muted"
                        >
                          <MediaThumb type={a.type} url={a.url} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{a.name}</span>
                            {a.description && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {a.description}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/70">No documents.</p>
                  )}
                </div>
              ) : viewMediaTab === "photos" ? (
                <div className="pt-3">
                  <ProjectMediaGrid projectId={viewingProject.id} />
                </div>
              ) : (
                <div className="pt-3">
                  {viewingProject.confidential_attachments?.length > 0 ||
                  inquiryDocuments.length > 0 ? (
                    <div className="space-y-4">
                      {viewingProject.confidential_attachments?.length > 0 && (
                        <div className="space-y-1.5">
                          {viewingProject.confidential_attachments.map((a, i) => (
                            <button
                              key={a.path}
                              type="button"
                              onClick={() =>
                                openConfidentialAttachments(
                                  viewingProject.confidential_attachments,
                                  i,
                                )
                              }
                              className="flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-left text-sm hover:bg-amber-500/10"
                            >
                              <ConfidentialThumb
                                path={a.path}
                                type={a.type}
                                getUrl={fetchConfidentialUrl}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{a.name}</span>
                                {a.description && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {a.description}
                                  </span>
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {inquiryDocuments.length > 0 && (
                        <div>
                          <span className="mb-1.5 block text-[11px] font-medium uppercase text-muted-foreground/60">
                            From linked inquiry
                          </span>
                          <div className="space-y-1.5">
                            {inquiryDocuments.map((doc, i) => {
                              const type = attachmentTypeFor(doc.contentType);
                              return (
                                <button
                                  key={doc.path}
                                  type="button"
                                  onClick={() => openConfidentialAttachments(inquiryDocuments, i)}
                                  className="flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-left text-sm hover:bg-amber-500/10"
                                >
                                  <ConfidentialThumb
                                    path={doc.path}
                                    type={type}
                                    getUrl={fetchConfidentialUrl}
                                  />
                                  <span className="min-w-0 flex-1 truncate font-medium">
                                    {doc.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/70">No confidential files.</p>
                  )}
                </div>
              )}
            </section>

            {viewingProject.inquiry_id && (
              <section className="mt-5">
                <button
                  type="button"
                  onClick={() => setInquiryAccordionOpen((v) => !v)}
                  className="flex w-full items-center justify-between border-b-2 border-primary/30 pb-2 text-sm font-bold uppercase tracking-wide text-foreground"
                >
                  View inquiry details
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${inquiryAccordionOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {inquiryAccordionOpen && linkedInquiry && (
                  <div className="mt-3 space-y-3">
                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      <DetailRow label="Customer Name">{linkedInquiry.name}</DetailRow>
                      {linkedInquiry.email && (
                        <DetailRow label="Email">{linkedInquiry.email}</DetailRow>
                      )}
                      {linkedInquiry.phone && (
                        <DetailRow label="Number">{linkedInquiry.phone}</DetailRow>
                      )}
                      <DetailRow label="Platform">{platformLabel(linkedInquiry.channel)}</DetailRow>
                      <DetailRow label="Submitted">
                        {new Date(linkedInquiry.created_at).toLocaleString()}
                      </DetailRow>
                      {linkedInquiry.message && (
                        <DetailRow label="Inquiry details">
                          <span className="whitespace-pre-wrap leading-relaxed">
                            {linkedInquiry.message}
                          </span>
                        </DetailRow>
                      )}
                    </div>
                    {linkedInquiry.checklist_responses?.length > 0 && (
                      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                        {linkedInquiry.checklist_responses.map((c) => (
                          <div
                            key={c.id}
                            className="grid grid-cols-[45%_1fr] items-start gap-3 px-3 py-2.5"
                          >
                            <span className="text-xs font-medium text-muted-foreground">
                              {c.label}
                            </span>
                            {c.type === "checkbox" ? (
                              <span className="inline-flex items-center gap-1.5">
                                {c.checked ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                ) : (
                                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                                )}
                                <span
                                  className={
                                    c.checked
                                      ? "font-medium text-emerald-700"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {c.checked ? "Yes" : "No"}
                                </span>
                              </span>
                            ) : c.type === "document" ? (
                              c.documents && c.documents.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {c.documents.map((doc, i) => (
                                    <button
                                      key={doc.path}
                                      type="button"
                                      onClick={() => openConfidentialAttachments(c.documents!, i)}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
                                    >
                                      <FileText className="h-3.5 w-3.5" /> {doc.name}
                                    </button>
                                  ))}
                                </div>
                              ) : c.hasDocument ? (
                                <span className="font-medium text-emerald-700">
                                  Yes (not uploaded)
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">No</span>
                              )
                            ) : (
                              <span
                                className={
                                  c.answer?.trim() ? "font-medium" : "text-muted-foreground/60"
                                }
                              >
                                {c.answer?.trim() || "—"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
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

      {lightbox && (
        <AttachmentLightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, location, service, team…"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="">All services</option>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value as "all" | "public" | "private")}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="all">Public + private</option>
          <option value="public">Public only</option>
          <option value="private">Private only</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as ProjectSortKey)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          {Object.entries(PROJECT_SORT_OPTIONS).map(([key, opt]) => (
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
              setServiceFilter("");
              setVisibilityFilter("all");
            }}
            className="rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && projects && projects.length > 0 && filteredProjects.length === 0 && (
        <p className="text-sm text-muted-foreground">No projects match your search or filter.</p>
      )}

      <div className="grid max-h-[calc(100vh-330px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {filteredProjects.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => openView(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openView(p);
            }}
            className="flex min-w-0 cursor-pointer gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm"
          >
            {p.cover_photo_url && (
              <img
                src={p.cover_photo_url}
                alt={p.title}
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <PublicToggle checked={p.is_public} onChange={() => togglePublic(p)} />
              </div>
              {p.location && <div className="text-xs text-muted-foreground">{p.location}</div>}
              <div className="text-xs text-muted-foreground">
                {p.service}
                {p.start_date ? ` · ${p.start_date}${p.end_date ? ` – ${p.end_date}` : ""}` : ""}
              </div>
              {p.personnel?.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Team: {p.personnel.join(", ")}
                </div>
              )}
              {p.attachments?.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.attachments.length} document{p.attachments.length === 1 ? "" : "s"} attached
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
