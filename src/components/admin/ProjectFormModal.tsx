import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  X,
  Trash2,
  FileText,
  Video,
  Image as ImageIcon,
  Lock,
  Play,
  Move,
  ArrowLeftRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createProject, updateProject, deleteProject } from "@/lib/admin/projects.functions";
import { PhotoPositionEditor } from "@/components/admin/PhotoPositionEditor";
import { CombinePhotoUpload, mergeSideBySide } from "@/components/admin/CombinePhotoUpload";
import { compressImage } from "@/lib/compressImage";
import { CoverImage, DEFAULT_IMAGE_POSITION, type ImagePosition } from "@/components/CoverImage";
import { createInquiry } from "@/lib/admin/inquiries.functions";
import {
  addGalleryPhoto,
  deleteGalleryPhoto,
  updateGalleryPhoto,
  listAllGalleryFolders,
  listAllGalleryPhotos,
} from "@/lib/admin/gallery.functions";
import {
  createSiteMediaUploadUrl,
  deleteSiteMedia,
  deleteConfidentialMedia,
  getConfidentialFileUrl,
} from "@/lib/admin/media.functions";
import { uploadFileDirect } from "@/lib/adminDirectUpload";
import { storagePathFromUrl } from "@/lib/storagePathFromUrl";
import { FileDrop } from "@/components/admin/FileDrop";
import { ConfidentialFileDrop } from "@/components/admin/ConfidentialFileDrop";
import { LocationAutosuggest } from "@/components/LocationAutosuggest";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import {
  AttachmentLightbox,
  kindFromContentType,
  type LightboxItem,
} from "@/components/AttachmentLightbox";

// Shared by ProjectAttachment/ConfidentialAttachment's `type` field and the
// AttachmentIcon/attachmentTypeFor helpers below. Photos/videos for a
// project live only in gallery_photos now (see ProjectPhotosTab) —
// ProjectAttachment narrows to documents only, but confidential attachments
// still span all three kinds.
export type AttachmentKind = "image" | "video" | "document";

export type ProjectAttachment = {
  url: string;
  path: string;
  type: "document";
  name: string;
  description?: string;
  isExternalLink?: boolean;
};
export type ConfidentialAttachment = {
  path: string;
  type: AttachmentKind;
  name: string;
  description?: string;
  isExternalLink?: boolean;
};

export type InquiryChecklistItem = {
  type: string;
  answer?: string;
  documents?: { path: string; name: string; contentType: string; isExternalLink?: boolean }[];
};

export type DefaultInquiry = {
  id: string;
  label: string;
  name: string;
  services: string[];
  checklist_responses: InquiryChecklistItem[];
};

function defaultTitleFromInquiry(name: string, services: string[] | undefined): string {
  return services && services.length > 0 ? `${services.join(", ")} - ${name}` : name;
}

function defaultLocationFromInquiry(
  checklistResponses: InquiryChecklistItem[] | undefined,
): string {
  return checklistResponses?.find((c) => c.type === "location")?.answer?.trim() ?? "";
}

export function inquiryDocumentsFrom(
  checklistResponses: InquiryChecklistItem[] | undefined,
): { path: string; name: string; contentType: string; isExternalLink?: boolean }[] {
  return (
    checklistResponses?.filter((c) => c.type === "document").flatMap((c) => c.documents ?? []) ?? []
  );
}

export type ProjectRecord = {
  id: string;
  title: string;
  location: string;
  description: string | null;
  service: string | null;
  services: string[];
  start_date: string | null;
  end_date: string | null;
  personnel: string[];
  photo_urls: string[];
  photo_positions: Record<string, ImagePosition>;
  attachments: ProjectAttachment[];
  confidential_attachments: ConfidentialAttachment[];
  is_public: boolean;
  size: "major" | "small";
  inquiry_id: string | null;
  sort_order: number;
};

type FormState = {
  title: string;
  location: string;
  description: string;
  services: string[];
  start_date: string;
  end_date: string;
  personnel: string[];
  photo_urls: string[];
  photo_positions: Record<string, ImagePosition>;
  attachments: ProjectAttachment[];
  confidential_attachments: ConfidentialAttachment[];
  is_public: boolean;
  size: "major" | "small";
  inquiry_id: string;
};

export function attachmentTypeFor(contentType: string): AttachmentKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

function AttachmentRow({
  attachment,
  onOpen,
  variant,
  onDescriptionChange,
  onRemove,
}: {
  attachment: { path: string; name: string; type: AttachmentKind; description?: string };
  onOpen?: () => void;
  variant: "public" | "confidential";
  onDescriptionChange: (description: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2 ${
        variant === "confidential"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border bg-background"
      }`}
    >
      <AttachmentIcon type={attachment.type} />
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          title={attachment.name}
          className="w-32 shrink-0 truncate text-left text-xs font-medium hover:underline"
        >
          {attachment.name}
        </button>
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

export function AttachmentIcon({ type }: { type: AttachmentKind }) {
  if (type === "image") return <ImageIcon className="h-4 w-4" />;
  if (type === "video") return <Video className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function emptyForm(): FormState {
  return {
    title: "",
    location: "",
    description: "",
    services: [],
    start_date: "",
    end_date: "",
    personnel: [],
    photo_urls: [],
    photo_positions: {},
    attachments: [],
    confidential_attachments: [],
    is_public: false,
    size: "small",
    inquiry_id: "",
  };
}

type ProjectGalleryPhoto = {
  id: string;
  url: string;
  storage_path: string | null;
  caption: string | null;
  media_type: "photo" | "video";
  sort_order: number;
};

// Photos & videos for a project live only in gallery_photos (see
// src/lib/project-gallery-sync.server.ts) — this reads/writes that table
// directly, scoped to the project's one linked folder, reusing the same
// admin server functions /admin/gallery uses. Only rendered once a project
// has an id (a folder needs a project_id to attach to).
function ProjectPhotosTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const doAddPhoto = useServerFn(addGalleryPhoto);
  const doDeletePhoto = useServerFn(deleteGalleryPhoto);
  const doUpdatePhoto = useServerFn(updateGalleryPhoto);
  const doListAllFolders = useServerFn(listAllGalleryFolders);
  const doListAllPhotos = useServerFn(listAllGalleryPhotos);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  // Admin-only server-function reads (bypass RLS via service role) — a
  // hidden folder/its photos must still be manageable here even though
  // gallery_folders/gallery_photos' RLS now strictly follows is_public.
  const { data: folder } = useQuery({
    queryKey: ["project-gallery-folder", projectId],
    queryFn: async () => {
      const folders = await doListAllFolders();
      return folders.find((f) => f.project_id === projectId) ?? null;
    },
  });
  const folderId = folder?.id ?? null;

  const { data: photos, isLoading } = useQuery({
    queryKey: ["project-gallery-photos", folderId],
    queryFn: async () =>
      (await doListAllPhotos({ data: { folderId: folderId as string } })) as ProjectGalleryPhoto[],
    enabled: !!folderId,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["project-gallery-photos", folderId] });
    queryClient.invalidateQueries({ queryKey: ["public-projects"] });
    queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
    queryClient.invalidateQueries({ queryKey: ["public-gallery"] });
  }

  async function onUploaded(result: { url: string; path?: string; contentType: string }) {
    if (!folderId) return;
    try {
      await doAddPhoto({
        data: {
          url: result.url,
          storage_path: result.path ?? result.url,
          media_type: result.contentType.startsWith("video/") ? "video" : "photo",
          folder_id: folderId,
          sort_order: photos?.length ?? 0,
          origin: "project",
        },
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function removePhoto(photo: ProjectGalleryPhoto) {
    if (!(await confirm("Remove this photo/video? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDeletePhoto({
        data: { id: photo.id, storage_path: photo.storage_path ?? undefined },
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function saveCaption(photo: ProjectGalleryPhoto, caption: string) {
    if (caption === (photo.caption ?? "")) return;
    try {
      await doUpdatePhoto({ data: { id: photo.id, caption: caption || null } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update caption");
    }
  }

  function openPhotoLightbox(list: ProjectGalleryPhoto[], startIndex: number) {
    const items: LightboxItem[] = list.map((p) => ({
      name: p.caption ?? "Photo",
      kind: p.media_type === "video" ? "video" : "image",
      resolveUrl: () => p.url,
    }));
    setLightbox({ items, index: startIndex });
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] text-muted-foreground/70">
        Visible to visitors on the public project page. No drag-reorder here — for that, use{" "}
        <a href="/admin/gallery" target="_blank" rel="noreferrer" className="underline">
          /admin/gallery
        </a>{" "}
        against this same folder.
      </p>
      <FileDrop
        folder="projects"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        allowExternalLink={false}
        label="Upload a photo or video"
        onUploaded={onUploaded}
      />
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : photos && photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              <button
                type="button"
                onClick={() => openPhotoLightbox(photos, i)}
                className="block h-full w-full"
              >
                {p.media_type === "video" ? (
                  <>
                    <video
                      src={p.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                        <Play className="h-3.5 w-3.5 fill-slate-900 text-slate-900" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" />
                )}
              </button>
              <button
                type="button"
                onClick={() => removePhoto(p)}
                className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <input
                defaultValue={p.caption ?? ""}
                onBlur={(e) => saveCaption(p, e.target.value)}
                placeholder="Caption"
                className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-[10px] text-white placeholder:text-white/50 focus:outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No photos or videos yet.</p>
      )}
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
        services: project.services ?? [],
        start_date: project.start_date ?? "",
        end_date: project.end_date ?? "",
        personnel: project.personnel ?? [],
        photo_urls: project.photo_urls ?? [],
        photo_positions: project.photo_positions ?? {},
        attachments: project.attachments ?? [],
        confidential_attachments: project.confidential_attachments ?? [],
        is_public: project.is_public ?? false,
        size: project.size ?? "small",
        inquiry_id: project.inquiry_id ?? "",
      };
    }
    const base = emptyForm();
    if (defaultInquiry) {
      base.title = defaultTitleFromInquiry(defaultInquiry.name, defaultInquiry.services);
      base.location = defaultLocationFromInquiry(defaultInquiry.checklist_responses);
      base.inquiry_id = defaultInquiry.id;
      base.services = defaultInquiry.services ?? [];
    }
    return base;
  });
  const [mediaTab, setMediaTab] = useState<"documents" | "photos" | "confidential">("documents");
  const [repositioningUrl, setRepositioningUrl] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [saving, setSaving] = useState(false);
  const doCreate = useServerFn(createProject);
  const doUpdate = useServerFn(updateProject);
  const doDelete = useServerFn(deleteProject);
  const doDeleteMedia = useServerFn(deleteSiteMedia);
  const doDeleteConfidential = useServerFn(deleteConfidentialMedia);
  const mintSiteMediaUpload = useServerFn(createSiteMediaUploadUrl);
  // Only combined (side-by-side merged) cover photos get a swap button —
  // the source files live here in memory only, so swapping is only
  // available for photos combined during this editing session (a page
  // reload loses the source images, same as any other unsaved form state).
  const [combinedSources, setCombinedSources] = useState<Record<string, [File, File]>>({});
  const [swappingUrl, setSwappingUrl] = useState<string | null>(null);
  // Lets an admin start uploading photos/videos for a brand-new project
  // before doing a final Save — we silently create the project row in the
  // background the first time they ask to upload, then treat it as a
  // normal edit from then on. If they close the modal without ever hitting
  // the real Save button, that draft (and anything uploaded to it) gets
  // discarded on close rather than left behind as orphaned data.
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [draftUnconfirmed, setDraftUnconfirmed] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const confirm = useConfirm();
  const doCreateInquiry = useServerFn(createInquiry);
  const [presetChannel, setPresetChannel] = useState<"referral" | "facebook" | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetPhone, setPresetPhone] = useState("");
  const [creatingPreset, setCreatingPreset] = useState(false);
  const { data: inquiries, refetch: refetchInquiries } = useQuery({
    queryKey: ["admin-inquiries-picker", project?.inquiry_id],
    queryFn: async () => {
      const [inquiriesRes, linkedRes] = await Promise.all([
        supabase
          .from("inquiries")
          .select("id, name, contact, services, created_at, checklist_responses, status")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("projects").select("inquiry_id").not("inquiry_id", "is", null),
      ]);
      if (inquiriesRes.error) throw inquiriesRes.error;
      if (linkedRes.error) throw linkedRes.error;
      const linkedIds = new Set(
        linkedRes.data
          .map((p) => p.inquiry_id)
          .filter((id) => id !== null && id !== project?.inquiry_id),
      );
      // Rejected/cancelled inquiries never turn into projects — except the
      // one already linked to this project, so an existing link stays
      // selectable/visible even if its status changed after the fact.
      return inquiriesRes.data.filter(
        (i) =>
          !linkedIds.has(i.id) &&
          (i.id === project?.inquiry_id || (i.status !== "Rejected" && i.status !== "Cancelled")),
      ) as {
        id: string;
        name: string;
        contact: string;
        services: string[];
        created_at: string;
        checklist_responses: InquiryChecklistItem[];
        status: string;
      }[];
    },
    enabled: !defaultInquiry,
  });

  const { data: services } = useQuery({
    queryKey: ["admin-services-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("title").order("sort_order");
      if (error) throw error;
      return data as { title: string }[];
    },
  });

  function selectInquiry(id: string) {
    const inquiry = inquiries?.find((i) => i.id === id);
    setForm((f) => ({
      ...f,
      inquiry_id: id,
      title:
        (!project || !f.title.trim()) && inquiry
          ? defaultTitleFromInquiry(inquiry.name, inquiry.services)
          : f.title,
      location:
        (!project || !f.location.trim()) && inquiry
          ? defaultLocationFromInquiry(inquiry.checklist_responses)
          : f.location,
      services:
        (!project || f.services.length === 0) && inquiry ? (inquiry.services ?? []) : f.services,
    }));
  }

  // Quick-create shortcuts for customers who reached out outside the
  // website (phone call / Facebook Messenger) — creates a real inquiry
  // (via the same path as the admin Inquiries page's "Add inquiry" form,
  // tagged with the matching channel) and links it immediately, instead of
  // requiring a trip to /admin/inquiries first.
  async function createPresetInquiry() {
    if (!presetChannel) return;
    if (!presetName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!presetPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    setCreatingPreset(true);
    try {
      const result = await doCreateInquiry({
        data: {
          name: presetName.trim(),
          phone: presetPhone.trim(),
          services: form.services,
          channel: presetChannel,
          message:
            presetChannel === "referral"
              ? "Reached out via phone call / referral."
              : "Reached out via Facebook Messenger.",
        },
      });
      await refetchInquiries();
      setForm((f) => ({
        ...f,
        inquiry_id: result.id,
        title:
          !project || !f.title.trim()
            ? defaultTitleFromInquiry(presetName.trim(), f.services)
            : f.title,
      }));
      toast.success("Inquiry created and linked");
      setPresetChannel(null);
      setPresetName("");
      setPresetPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create inquiry");
    } finally {
      setCreatingPreset(false);
    }
  }

  const selectedInquiryChecklist =
    defaultInquiry?.checklist_responses ??
    inquiries?.find((i) => i.id === form.inquiry_id)?.checklist_responses;
  const inquiryDocuments = inquiryDocumentsFrom(selectedInquiryChecklist);
  const doGetConfidentialUrl = useServerFn(getConfidentialFileUrl);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  function openPublicAttachmentsLightbox(docs: ProjectAttachment[], startIndex: number) {
    const items: LightboxItem[] = docs.map((d) => ({
      name: d.name,
      kind: d.isExternalLink ? "external" : d.type,
      resolveUrl: () => d.url,
    }));
    setLightbox({ items, index: startIndex });
  }

  function openConfidentialAttachmentsLightbox(
    docs: {
      path: string;
      name: string;
      type?: AttachmentKind;
      contentType?: string;
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

  const requiredInquiryMissing = !project && !defaultInquiry && !form.inquiry_id;

  function addAttachment(result: {
    url: string;
    path?: string;
    contentType: string;
    name: string;
    isExternalLink?: boolean;
  }) {
    setForm((f) => ({
      ...f,
      attachments: [
        ...f.attachments,
        {
          url: result.url,
          path: result.isExternalLink ? result.url : (result.path ?? result.url),
          type: "document",
          name: result.name,
          isExternalLink: result.isExternalLink,
        },
      ],
    }));
  }

  async function removeAttachment(attachment: ProjectAttachment) {
    if (!(await confirm("Remove this file? This cannot be undone.", { destructive: true }))) return;
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((a) => a.path !== attachment.path),
    }));
    if (attachment.isExternalLink) return;
    try {
      await doDeleteMedia({ data: { path: attachment.path } });
    } catch (err) {
      console.error(err);
    }
  }

  function addConfidentialAttachment(result: {
    path: string;
    contentType: string;
    name: string;
    isExternalLink?: boolean;
  }) {
    setForm((f) => ({
      ...f,
      confidential_attachments: [
        ...f.confidential_attachments,
        {
          path: result.path,
          type: result.isExternalLink ? "document" : attachmentTypeFor(result.contentType),
          name: result.name,
          isExternalLink: result.isExternalLink,
        },
      ],
    }));
  }

  async function removeConfidentialAttachment(attachment: ConfidentialAttachment) {
    if (!(await confirm("Remove this file? This cannot be undone.", { destructive: true }))) return;
    setForm((f) => ({
      ...f,
      confidential_attachments: f.confidential_attachments.filter(
        (a) => a.path !== attachment.path,
      ),
    }));
    if (attachment.isExternalLink) return;
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

  async function removeCoverPhoto(url: string) {
    setForm((f) => {
      const { [url]: _removed, ...rest } = f.photo_positions;
      return {
        ...f,
        photo_urls: f.photo_urls.filter((u) => u !== url),
        photo_positions: rest,
      };
    });
    setCombinedSources((s) => {
      const { [url]: _removed, ...rest } = s;
      return rest;
    });
    const path = storagePathFromUrl(url, "site-media");
    if (!path) return;
    try {
      await doDeleteMedia({ data: { path } });
    } catch (err) {
      console.error(err);
    }
  }

  async function swapCombinedPhoto(url: string) {
    const sources = combinedSources[url];
    if (!sources) return;
    setSwappingUrl(url);
    try {
      const merged = await mergeSideBySide([sources[1], sources[0]]);
      const swappedFile = await compressImage(merged);
      const result = await uploadFileDirect(mintSiteMediaUpload, "site-media", swappedFile, {
        folder: "projects",
      });
      const newUrl = result.url!;
      setForm((f) => {
        const idx = f.photo_urls.indexOf(url);
        if (idx === -1) return f;
        const nextUrls = [...f.photo_urls];
        nextUrls[idx] = newUrl;
        const { [url]: oldPosition, ...restPositions } = f.photo_positions;
        return {
          ...f,
          photo_urls: nextUrls,
          photo_positions: oldPosition
            ? { ...restPositions, [newUrl]: oldPosition }
            : restPositions,
        };
      });
      setCombinedSources((s) => {
        const { [url]: _old, ...rest } = s;
        return { ...rest, [newUrl]: [sources[1], sources[0]] };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to swap photo positions");
    } finally {
      setSwappingUrl(null);
    }
  }

  function buildPayload() {
    return {
      title: form.title.trim(),
      location: form.location.trim(),
      description: form.description.trim() || undefined,
      services: form.services,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      personnel: form.personnel,
      photo_urls: form.photo_urls,
      photo_positions: form.photo_positions,
      attachments: form.attachments,
      confidential_attachments: form.confidential_attachments,
      is_public: form.is_public,
      size: form.size,
      inquiry_id: defaultInquiry?.id || form.inquiry_id || undefined,
      sort_order: project?.sort_order ?? 0,
    };
  }

  // Enables the Photos & videos tab for a not-yet-saved project by quietly
  // creating it now instead of waiting for the real Save — the required
  // fields (title, location, inquiry) still have to be filled in first, so
  // this never creates a genuinely empty row.
  const canStartUploading =
    !!form.title.trim() && !!form.location.trim() && !!(defaultInquiry?.id || form.inquiry_id);
  const activeProjectId = project?.id ?? draftProjectId;

  async function startUploadingPhotos() {
    if (!canStartUploading || creatingDraft) return;
    setCreatingDraft(true);
    try {
      const result = await doCreate({ data: buildPayload() });
      setDraftProjectId(result.id);
      setDraftUnconfirmed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to prepare project for uploads");
    } finally {
      setCreatingDraft(false);
    }
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
    const payload = buildPayload();
    setSaving(true);
    try {
      if (activeProjectId) {
        await doUpdate({ data: { id: activeProjectId, ...payload } });
        toast.success(project ? "Project updated" : "Project created");
      } else {
        await doCreate({ data: payload });
        toast.success("Project created");
      }
      setDraftUnconfirmed(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!(await confirm("Delete this project? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDelete({ data: { id: project.id } });
      toast.success("Project deleted");
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  // Routes every way of closing the modal (X, backdrop, Cancel) through
  // here so an unconfirmed draft — created just to unlock photo/video
  // uploads before a real Save — never gets left behind as an orphaned
  // project when the admin backs out instead of saving.
  async function handleClose() {
    if (draftProjectId && draftUnconfirmed) {
      if (
        !(await confirm(
          "Discard this project and anything uploaded to it so far? This cannot be undone.",
          { destructive: true },
        ))
      ) {
        return;
      }
      try {
        await doDelete({ data: { id: draftProjectId } });
      } catch (err) {
        console.error(err);
      }
    }
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        onClick={handleClose}
      >
        <div
          className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{project ? "Edit project" : "New project"}</h2>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-10">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cover photos
              </h3>
              <p className="mb-2 text-[11px] text-muted-foreground/70">
                Shown as a horizontal row on the public project card and detail popup. The first
                photo is used wherever only one image fits (e.g. the admin list thumbnail).
              </p>
              {form.photo_urls.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {form.photo_urls.map((url, i) => {
                    const pos = form.photo_positions[url] ?? DEFAULT_IMAGE_POSITION;
                    return (
                      <div
                        key={url}
                        className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-border"
                      >
                        <CoverImage src={url} alt={`Cover ${i + 1}`} position={pos} />
                        <button
                          type="button"
                          onClick={() => setRepositioningUrl(url)}
                          className="absolute bottom-1 left-1 rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
                          aria-label={`Reposition cover photo ${i + 1}`}
                        >
                          <Move className="h-3.5 w-3.5" />
                        </button>
                        {combinedSources[url] && (
                          <button
                            type="button"
                            onClick={() => swapCombinedPhoto(url)}
                            disabled={swappingUrl === url}
                            className="absolute bottom-1 left-9 rounded-md bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-60"
                            aria-label={`Swap the two photos' positions in cover photo ${i + 1}`}
                            title="Swap the two photos' positions"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCoverPhoto(url)}
                          className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
                          aria-label={`Remove cover photo ${i + 1}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-start gap-3">
                <div className="max-w-sm">
                  <FileDrop
                    folder="projects"
                    accept="image/jpeg,image/png,image/webp"
                    label="Upload a cover photo"
                    allowExternalLink={false}
                    onUploaded={(result) =>
                      setForm((f) => ({ ...f, photo_urls: [...f.photo_urls, result.url] }))
                    }
                  />
                </div>
                <CombinePhotoUpload
                  onUploaded={(result) => {
                    setForm((f) => ({ ...f, photo_urls: [...f.photo_urls, result.url] }));
                    if (result.sourceFiles) {
                      setCombinedSources((s) => ({ ...s, [result.url]: result.sourceFiles! }));
                    }
                  }}
                />
              </div>
            </section>

            {defaultInquiry ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Linked inquiry
                </span>
                <p className="mt-0.5 font-medium">{defaultInquiry.label}</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Linked inquiry{" "}
                    {!project && <span className="text-destructive">(required)</span>}
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
                        {i.services?.length > 0 ? ` · ${i.services.join(", ")}` : ""}
                      </option>
                    ))}
                  </select>
                  {requiredInquiryMissing && (
                    <p className="mt-1 text-xs text-destructive">
                      Projects are always created from an inquiry — pick which one this belongs to.
                    </p>
                  )}
                </label>

                {presetChannel ? (
                  <div className="mt-2 space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      New inquiry from {presetChannel === "referral" ? "Referral" : "Facebook"}
                    </p>
                    <input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Customer name"
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    />
                    <input
                      value={presetPhone}
                      onChange={(e) => setPresetPhone(e.target.value)}
                      placeholder="Phone number"
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={createPresetInquiry}
                        disabled={creatingPreset}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {creatingPreset ? "Creating…" : "Create & link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPresetChannel(null);
                          setPresetName("");
                          setPresetPhone("");
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPresetChannel("referral")}
                      className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      + Inquiry from Referral
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetChannel("facebook")}
                      className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      + Inquiry from Facebook
                    </button>
                  </div>
                )}
              </div>
            )}

            <section>
              <h3 className="mb-5 border-b-2 border-primary/30 pb-2.5 text-sm font-bold uppercase tracking-wide text-foreground">
                Project details
              </h3>
              <div className="grid gap-3 pl-4 sm:grid-cols-2">
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
                <div className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Services
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(services ?? []).map((s) => {
                      const checked = form.services.includes(s.title);
                      return (
                        <button
                          key={s.title}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              services: checked
                                ? f.services.filter((x) => x !== s.title)
                                : [...f.services, s.title],
                            }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            checked
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:bg-muted"
                          }`}
                        >
                          {s.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Location <span className="text-destructive">(required)</span>
                  </span>
                  <LocationAutosuggest
                    value={form.location}
                    onChange={(v) => setForm({ ...form, location: v })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Show on public site
                  </span>
                </label>
                <div className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Project size (admin only)
                  </span>
                  <div className="flex gap-1.5">
                    {(["small", "major"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, size: s })}
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium capitalize ${
                          form.size === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Date range
                  </span>
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
                        <button
                          type="button"
                          onClick={() => removePerson(name)}
                          aria-label={`Remove ${name}`}
                        >
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
                    onClick={() => setMediaTab("documents")}
                    className={`border-b-2 px-3 py-2 text-sm font-medium ${
                      mediaTab === "documents"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaTab("photos")}
                    className={`border-b-2 px-3 py-2 text-sm font-medium ${
                      mediaTab === "photos"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Photos &amp; videos
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

                {mediaTab === "documents" ? (
                  <div className="pt-3">
                    <p className="mb-1.5 text-[11px] text-muted-foreground/70">
                      Documents visible to visitors on the public project page (e.g. PDFs). For
                      photos and videos, use the Photos &amp; videos tab.
                    </p>
                    <FileDrop
                      folder="projects"
                      accept="application/pdf"
                      label="Upload a document"
                      onUploaded={addAttachment}
                    />
                    {form.attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {form.attachments.map((a, i) => (
                          <AttachmentRow
                            key={a.path}
                            attachment={a}
                            onOpen={() => openPublicAttachmentsLightbox(form.attachments, i)}
                            variant="public"
                            onDescriptionChange={(description) =>
                              updateAttachmentDescription(a.path, description)
                            }
                            onRemove={() => removeAttachment(a)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : mediaTab === "photos" ? (
                  <div className="pt-3">
                    {activeProjectId ? (
                      <ProjectPhotosTab projectId={activeProjectId} />
                    ) : canStartUploading ? (
                      <div className="rounded-md border border-dashed border-border p-4 text-center">
                        <p className="mb-2 text-sm text-muted-foreground">
                          You can start uploading photos and videos now — the project is created in
                          the background, and you can keep editing everything else before doing a
                          final save.
                        </p>
                        <button
                          type="button"
                          onClick={startUploadingPhotos}
                          disabled={creatingDraft}
                          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {creatingDraft ? "Preparing…" : "Start uploading photos & videos"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Fill in the title, location, and linked inquiry above first, then come back
                        here to add photos and videos before doing a final save.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="pt-3">
                    <p className="mb-1.5 text-[11px] text-muted-foreground/70">
                      Only visible to admins here — never shown on the public site. Files from the
                      linked inquiry sync here automatically as they come in.
                    </p>
                    <ConfidentialFileDrop onUploaded={addConfidentialAttachment} />
                    {form.confidential_attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {form.confidential_attachments.map((a, i) => (
                          <AttachmentRow
                            key={a.path}
                            attachment={a}
                            onOpen={() =>
                              openConfidentialAttachmentsLightbox(form.confidential_attachments, i)
                            }
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
                          {inquiryDocuments.map((doc, i) => (
                            <button
                              key={doc.path}
                              type="button"
                              onClick={() =>
                                openConfidentialAttachmentsLightbox(inquiryDocuments, i)
                              }
                              className="flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-left text-sm hover:bg-amber-500/10"
                            >
                              <AttachmentIcon type={attachmentTypeFor(doc.contentType)} />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {doc.name}
                              </span>
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
            <button
              onClick={handleClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
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
      {lightbox && (
        <AttachmentLightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
      {repositioningUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setRepositioningUrl(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold">Reposition cover photo</h3>
            <PhotoPositionEditor
              imageUrl={repositioningUrl}
              position={form.photo_positions[repositioningUrl] ?? DEFAULT_IMAGE_POSITION}
              onChange={(pos) =>
                setForm((f) => ({
                  ...f,
                  photo_positions: { ...f.photo_positions, [repositioningUrl]: pos },
                }))
              }
            />
            <button
              type="button"
              onClick={() => setRepositioningUrl(null)}
              className="mt-3 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
