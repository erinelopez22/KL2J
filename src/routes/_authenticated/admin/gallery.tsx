import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Trash2,
  Play,
  Folder,
  FolderOpen,
  X,
  Pencil,
  Link2,
  Search,
  Copy,
  FolderInput,
  Check,
} from "lucide-react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import {
  addGalleryPhoto,
  deleteGalleryPhoto,
  updateGalleryPhoto,
  createGalleryFolder,
  updateGalleryFolder,
  deleteGalleryFolder,
  moveGalleryPhotos,
  copyGalleryPhotos,
  deleteGalleryPhotosBulk,
} from "@/lib/admin/gallery.functions";
import { FileDrop } from "@/components/admin/FileDrop";
import { PublicToggle } from "@/components/admin/PublicToggle";
import { LocationAutosuggest } from "@/components/LocationAutosuggest";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { AttachmentLightbox, type LightboxItem } from "@/components/AttachmentLightbox";
import { useRealtimeInvalidate } from "@/lib/useRealtimeInvalidate";

export const Route = createFileRoute("/_authenticated/admin/gallery")({
  component: AdminGallery,
});

type Photo = {
  id: string;
  url: string;
  storage_path: string | null;
  caption: string | null;
  sort_order: number;
  media_type: "photo" | "video";
  folder_id: string | null;
  created_at: string;
};

type GalleryFolder = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  date_start: string | null;
  date_end: string | null;
  sort_order: number;
  project_id: string | null;
  is_public: boolean;
};

type ProjectOption = { id: string; title: string; is_public: boolean };

const UNSORTED_DROP_ID = "folder:unsorted";
const FOLDER_DROP_PREFIX = "folder:";
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 560;

const SORT_OPTIONS = {
  newest: {
    label: "Newest first",
    cmp: (a: Photo, b: Photo) => b.created_at.localeCompare(a.created_at),
  },
  oldest: {
    label: "Oldest first",
    cmp: (a: Photo, b: Photo) => a.created_at.localeCompare(b.created_at),
  },
  name_asc: {
    label: "Name A-Z",
    cmp: (a: Photo, b: Photo) => filenameFor(a).localeCompare(filenameFor(b)),
  },
} as const;
type SortKey = keyof typeof SORT_OPTIONS;

function filenameFor(p: Photo): string {
  if (p.caption) return p.caption;
  const path = p.storage_path ?? p.url;
  const last = path.split("/").pop() ?? path;
  return decodeURIComponent(last);
}

function emptyFolderForm() {
  return { name: "", description: "", location: "", date_start: "", date_end: "", project_id: "" };
}

function DraggablePhoto({
  photo,
  selected,
  onOpen,
  onDelete,
  onToggleSelect,
}: {
  photo: Photo;
  selected: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `photo:${photo.id}`,
    data: { photo },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={`group relative aspect-square cursor-grab overflow-hidden rounded-lg border ${
        selected ? "border-primary ring-2 ring-primary" : "border-border"
      } ${isDragging ? "opacity-30" : ""}`}
    >
      {photo.media_type === "video" ? (
        <>
          <video
            src={photo.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/20">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
              <Play className="h-4 w-4 fill-slate-900 text-slate-900" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={photo.url}
          alt={photo.caption ?? "Gallery photo"}
          className="h-full w-full object-cover"
        />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        aria-label={selected ? "Deselect" : "Select"}
        className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border transition ${
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-white/70 bg-black/40 text-transparent opacity-0 hover:border-white group-hover:opacity-100"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
        aria-label="Delete photo"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function FolderDropZone({
  id,
  active,
  count,
  linked,
  onClick,
  onEdit,
  onDelete,
  children,
}: {
  id: string;
  active: boolean;
  count: number;
  linked?: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  children: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={children}
      className={`group flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm cursor-pointer transition ${
        isOver
          ? "bg-primary/15 ring-2 ring-primary"
          : active
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {active ? (
          <FolderOpen className="h-4 w-4 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{children}</span>
        {linked && (
          <Link2
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-label="Linked to a project"
          />
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span className="text-xs text-muted-foreground">{count}</span>
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded p-1 opacity-0 hover:bg-muted group-hover:opacity-100"
            aria-label="Edit folder"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-destructive opacity-0 hover:bg-destructive/10 group-hover:opacity-100"
            aria-label="Delete folder"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

function AdminGallery() {
  const queryClient = useQueryClient();
  const doAdd = useServerFn(addGalleryPhoto);
  const doDelete = useServerFn(deleteGalleryPhoto);
  const doUpdatePhoto = useServerFn(updateGalleryPhoto);
  const doCreateFolder = useServerFn(createGalleryFolder);
  const doUpdateFolder = useServerFn(updateGalleryFolder);
  const doDeleteFolder = useServerFn(deleteGalleryFolder);
  const doMovePhotos = useServerFn(moveGalleryPhotos);
  const doCopyPhotos = useServerFn(copyGalleryPhotos);
  const doDeletePhotosBulk = useServerFn(deleteGalleryPhotosBulk);
  const confirm = useConfirm();
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [selected, setSelected] = useState<"all" | "unsorted" | string>("all");
  // Mobile (<lg) shows only the folder list in-flow; tapping a folder opens
  // this full-screen popup with that folder's content instead. No-op on
  // desktop, where the popup markup is `lg:hidden`.
  const [mobilePopupOpen, setMobilePopupOpen] = useState(false);
  const [folderModal, setFolderModal] = useState<{
    editing: GalleryFolder | null;
    form: ReturnType<typeof emptyFolderForm>;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "photo" | "video">("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState<string>(UNSORTED_DROP_ID);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem("gallery-sidebar-width"));
    return saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH ? saved : 240;
  });
  const resizingRef = useRef(false);

  function startSidebarResize(e: React.PointerEvent) {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    function onMove(ev: PointerEvent) {
      if (!resizingRef.current) return;
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + (ev.clientX - startX)),
      );
      setSidebarWidth(next);
    }
    function onUp() {
      resizingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setSidebarWidth((w) => {
        localStorage.setItem("gallery-sidebar-width", String(w));
        return w;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: photos, isLoading } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery_photos").select("*").order("sort_order");
      if (error) throw error;
      return data as Photo[];
    },
  });
  useRealtimeInvalidate("gallery_photos", [["admin-gallery"]]);

  const { data: folders } = useQuery({
    queryKey: ["admin-gallery-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_folders")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as GalleryFolder[];
    },
  });
  useRealtimeInvalidate("gallery_folders", [["admin-gallery-folders"]]);

  const { data: projects } = useQuery({
    queryKey: ["admin-gallery-projects-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, is_public")
        .order("title");
      if (error) throw error;
      return data as ProjectOption[];
    },
  });
  const linkedProjectIds = new Set((folders ?? []).map((f) => f.project_id).filter(Boolean));
  const linkableProjects = (projects ?? []).filter((p) => !linkedProjectIds.has(p.id));
  const selectedFolder =
    selected !== "all" && selected !== "unsorted"
      ? (folders ?? []).find((f) => f.id === selected)
      : undefined;
  const selectedFolderProject = selectedFolder?.project_id
    ? (projects ?? []).find((p) => p.id === selectedFolder.project_id)
    : undefined;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
    queryClient.invalidateQueries({ queryKey: ["public-gallery"] });
    // gallery_photos is a project's only copy of its photos/videos now — a
    // project-linked folder's data IS that project's media, so project
    // views (which embed gallery_photos directly) must refetch too.
    queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    queryClient.invalidateQueries({ queryKey: ["public-projects"] });
  }
  function refreshFolders() {
    queryClient.invalidateQueries({ queryKey: ["admin-gallery-folders"] });
    queryClient.invalidateQueries({ queryKey: ["public-gallery-folders"] });
  }

  async function onUploaded(result: { url: string; path?: string; contentType: string }) {
    try {
      await doAdd({
        data: {
          url: result.url,
          storage_path: result.path,
          sort_order: (photos?.length ?? 0) + 1,
          media_type: result.contentType.startsWith("video/") ? "video" : "photo",
          folder_id: selected !== "all" && selected !== "unsorted" ? selected : null,
        },
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save photo");
    }
  }

  async function remove(photo: Photo) {
    if (!(await confirm("Delete this photo/video? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDelete({ data: { id: photo.id, storage_path: photo.storage_path ?? undefined } });
      toast.success("Photo deleted");
      setSelectedIds((s) => {
        const next = new Set(s);
        next.delete(photo.id);
        return next;
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith(FOLDER_DROP_PREFIX)) return;
    const photo = active.data.current?.photo as Photo | undefined;
    if (!photo) return;
    const targetFolderId =
      overId === UNSORTED_DROP_ID ? null : overId.slice(FOLDER_DROP_PREFIX.length);
    if (targetFolderId === photo.folder_id) return;
    try {
      await doUpdatePhoto({ data: { id: photo.id, folder_id: targetFolderId } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move photo");
    }
  }

  function openNewFolder() {
    setFolderModal({ editing: null, form: emptyFolderForm() });
  }
  function openEditFolder(f: GalleryFolder) {
    setFolderModal({
      editing: f,
      form: {
        name: f.name,
        description: f.description ?? "",
        location: f.location ?? "",
        date_start: f.date_start ?? "",
        date_end: f.date_end ?? "",
        project_id: f.project_id ?? "",
      },
    });
  }

  async function saveFolder() {
    if (!folderModal) return;
    const { editing, form } = folderModal;
    if (!form.name.trim() && !form.project_id) {
      toast.error("Folder name is required");
      return;
    }
    // The server only falls back to the linked project's title when the
    // name is left blank (see resolveFolderName) — fall back the same way
    // here so validation still passes if the admin left it empty, but a
    // typed name (including for a project-linked folder) is respected.
    const linkedProjectTitle = form.project_id
      ? (projects?.find((p) => p.id === form.project_id)?.title ?? "Untitled")
      : "";
    const payload = {
      name: form.name.trim() || linkedProjectTitle,
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      date_start: form.date_start || null,
      date_end: form.date_end || null,
      project_id: form.project_id || null,
    };
    try {
      if (editing) {
        await doUpdateFolder({ data: { id: editing.id, ...payload } });
      } else {
        await doCreateFolder({ data: { ...payload, sort_order: (folders?.length ?? 0) + 1 } });
      }
      refreshFolders();
      setFolderModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save folder");
    }
  }

  async function toggleFolderPublic(folder: GalleryFolder) {
    try {
      await doUpdateFolder({ data: { id: folder.id, is_public: !folder.is_public } });
      refreshFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function deleteFolderWithConfirm(folder: GalleryFolder) {
    const count = (photos ?? []).filter((p) => p.folder_id === folder.id).length;
    const countPart =
      count > 0
        ? ` This permanently deletes it and its ${count} photo${count === 1 ? "" : "s"}/video${count === 1 ? "" : "s"}.`
        : "";
    const linkedPart = folder.project_id
      ? ` It's linked to a project — its photos/videos will also be removed from that project's attachments (a new folder is created automatically next time you save that project with a photo or video attached).`
      : "";
    if (
      !(await confirm(`Delete "${folder.name}"?${countPart}${linkedPart} This cannot be undone.`, {
        destructive: true,
      }))
    )
      return;
    try {
      await doDeleteFolder({ data: { id: folder.id } });
      toast.success("Folder deleted");
      refreshFolders();
      refresh();
      if (selected === folder.id) setSelected("all");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete folder");
    }
  }

  async function removeFolder() {
    if (!folderModal?.editing) return;
    await deleteFolderWithConfirm(folderModal.editing);
    setFolderModal(null);
  }

  const inFolder = useMemo(() => {
    if (!photos) return [];
    if (selected === "all") return photos;
    if (selected === "unsorted") return photos.filter((p) => !p.folder_id);
    return photos.filter((p) => p.folder_id === selected);
  }, [photos, selected]);

  const searchLower = search.trim().toLowerCase();
  const visible = useMemo(() => {
    return inFolder
      .filter((p) => {
        if (mediaFilter !== "all" && p.media_type !== mediaFilter) return false;
        if (!searchLower) return true;
        return filenameFor(p).toLowerCase().includes(searchLower);
      })
      .sort(SORT_OPTIONS[sortKey].cmp);
  }, [inFolder, mediaFilter, searchLower, sortKey]);

  const unsortedCount = (photos ?? []).filter((p) => !p.folder_id).length;

  function toggleSelect(id: string) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((s) => {
      const allVisible = visible.every((p) => s.has(p.id));
      if (allVisible) return new Set();
      return new Set(visible.map((p) => p.id));
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function targetFolderId(): string | null {
    return moveTarget === UNSORTED_DROP_ID ? null : moveTarget;
  }

  async function handleMoveSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      await doMovePhotos({ data: { ids, folderId: targetFolderId() } });
      toast.success(`Moved ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      clearSelection();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move");
    }
  }

  async function handleCopySelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      await doCopyPhotos({ data: { ids, folderId: targetFolderId() } });
      toast.success(`Copied ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      clearSelection();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to copy");
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !(await confirm(
        `Delete ${ids.length} photo${ids.length === 1 ? "" : "s"}/video${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
        { destructive: true },
      ))
    )
      return;
    try {
      await doDeletePhotosBulk({ data: { ids } });
      toast.success(`Deleted ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      clearSelection();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selectedIds.has(p.id));

  // Rendered both in-flow on desktop and inside the mobile full-screen
  // popup — defined once here so the two render sites below stay in sync.
  const mainPaneContent = (
    <>
      {selectedFolder && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words text-sm font-semibold">{selectedFolder.name}</p>
            {selectedFolder.project_id ? (
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium uppercase ${
                  selectedFolderProject?.is_public
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                }`}
                title="This folder's visibility follows its linked project — change the project's Public toggle to update it"
              >
                {selectedFolderProject?.is_public ? "Public" : "Hidden"} (via project)
              </span>
            ) : (
              <PublicToggle
                checked={selectedFolder.is_public}
                onChange={() => toggleFolderPublic(selectedFolder)}
              />
            )}
          </div>
          {selectedFolderProject && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Link2 className="h-3 w-3 shrink-0" />
              Linked to project: <span className="font-medium">{selectedFolderProject.title}</span>
            </p>
          )}
          {selectedFolder.location && (
            <p className="mt-0.5 text-xs text-muted-foreground">{selectedFolder.location}</p>
          )}
          {selectedFolder.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{selectedFolder.description}</p>
          )}
        </div>
      )}
      <div className="max-w-sm">
        <FileDrop
          folder="gallery"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          label="Upload a photo or video"
          allowExternalLink={false}
          onUploaded={onUploaded}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename or caption…"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={mediaFilter}
          onChange={(e) => setMediaFilter(e.target.value as "all" | "photo" | "video")}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="all">Photos + videos</option>
          <option value="photo">Photos only</option>
          <option value="video">Videos only</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          {Object.entries(SORT_OPTIONS).map(([key, opt]) => (
            <option key={key} value={key}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        {(search || mediaFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setMediaFilter("all");
            }}
            className="rounded-md border border-border px-3 h-10 text-sm hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {visible.length > 0 && (
        <label className="mt-3 flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-border"
          />
          Select all ({visible.length})
        </label>
      )}

      {selectedIds.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <select
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value={UNSORTED_DROP_ID}>Unsorted</option>
            {(folders ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCopySelected}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            type="button"
            onClick={handleMoveSelected}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <FolderInput className="h-3.5 w-3.5" /> Move
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Clear
          </button>
        </div>
      )}

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && visible.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          {inFolder.length === 0 ? "Nothing here yet." : "No items match your search or filter."}
        </p>
      )}

      <div className="mt-3 grid max-h-[calc(100vh-400px)] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
        {visible.map((p, i) => (
          <DraggablePhoto
            key={p.id}
            photo={p}
            selected={selectedIds.has(p.id)}
            onToggleSelect={() => toggleSelect(p.id)}
            onOpen={() =>
              setLightbox({
                items: visible.map((s) => ({
                  name: s.caption ?? "Gallery item",
                  kind: s.media_type === "video" ? "video" : "image",
                  resolveUrl: () => s.url,
                })),
                index: i,
              })
            }
            onDelete={() => remove(p)}
          />
        ))}
      </div>
    </>
  );

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Field photos and videos shown in the public gallery section. Organize them into folders
          and drag tiles onto a folder to move them.
        </p>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <div
            className="shrink-0 space-y-1 lg:w-[var(--sidebar-w)]"
            style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
          >
            <FolderDropZone
              id="folder:__all__"
              active={selected === "all"}
              count={photos?.length ?? 0}
              onClick={() => {
                setSelected("all");
                setMobilePopupOpen(true);
              }}
            >
              All
            </FolderDropZone>
            <FolderDropZone
              id={UNSORTED_DROP_ID}
              active={selected === "unsorted"}
              count={unsortedCount}
              onClick={() => {
                setSelected("unsorted");
                setMobilePopupOpen(true);
              }}
            >
              Unsorted
            </FolderDropZone>
            <div className="my-2 border-t border-border" />
            <div className="max-h-[600px] space-y-1 overflow-y-auto pr-1">
              {(folders ?? []).map((f) => (
                <FolderDropZone
                  key={f.id}
                  id={`${FOLDER_DROP_PREFIX}${f.id}`}
                  active={selected === f.id}
                  count={(photos ?? []).filter((p) => p.folder_id === f.id).length}
                  linked={!!f.project_id}
                  onClick={() => {
                    setSelected(f.id);
                    setMobilePopupOpen(true);
                  }}
                  onEdit={() => openEditFolder(f)}
                  onDelete={() => deleteFolderWithConfirm(f)}
                >
                  {f.name}
                </FolderDropZone>
              ))}
            </div>
            <button
              onClick={openNewFolder}
              className="mt-2 w-full rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              + New Folder
            </button>
          </div>

          <div
            onPointerDown={startSidebarResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize folder sidebar"
            title="Drag to resize"
            className="hidden w-1.5 shrink-0 cursor-col-resize rounded-full bg-border transition hover:bg-primary/40 active:bg-primary/60 lg:block"
          />

          <div className="hidden min-w-0 flex-1 lg:block">{mainPaneContent}</div>
        </div>

        {mobilePopupOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold">
                {selected === "all"
                  ? "All"
                  : selected === "unsorted"
                    ? "Unsorted"
                    : selectedFolder?.name}
              </p>
              <button
                onClick={() => setMobilePopupOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Back to folders"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{mainPaneContent}</div>
          </div>
        )}

        {lightbox && (
          <AttachmentLightbox
            items={lightbox.items}
            startIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        )}

        {folderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {folderModal.editing ? "Edit folder" : "New folder"}
                </h2>
                <button onClick={() => setFolderModal(null)} className="rounded p-1 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {folderModal.editing?.project_id && (
                <div className="mt-3 flex items-start gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  Linked to a project — its photos/videos stay in sync with that project, but the
                  folder name is independent, so you can rename it freely. Use "Delete folder" below
                  to remove it and its photos/videos everywhere, including from that project's
                  attachments.
                </div>
              )}
              <div className="mt-4 space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Name
                  </span>
                  <input
                    value={folderModal.form.name}
                    placeholder={
                      folderModal.form.project_id
                        ? (projects?.find((p) => p.id === folderModal.form.project_id)?.title ?? "")
                        : ""
                    }
                    onChange={(e) =>
                      setFolderModal({
                        ...folderModal,
                        form: { ...folderModal.form, name: e.target.value },
                      })
                    }
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Description
                  </span>
                  <textarea
                    rows={3}
                    value={folderModal.form.description}
                    onChange={(e) =>
                      setFolderModal({
                        ...folderModal,
                        form: { ...folderModal.form, description: e.target.value },
                      })
                    }
                    className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Location
                  </span>
                  <LocationAutosuggest
                    value={folderModal.form.location}
                    onChange={(v) =>
                      setFolderModal({ ...folderModal, form: { ...folderModal.form, location: v } })
                    }
                  />
                </label>
                {!folderModal.editing?.project_id && linkableProjects.length > 0 && (
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Link to project (optional)
                    </span>
                    <select
                      value={folderModal.form.project_id}
                      onChange={(e) =>
                        setFolderModal({
                          ...folderModal,
                          form: { ...folderModal.form, project_id: e.target.value },
                        })
                      }
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="">— None —</option>
                      {linkableProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    {folderModal.form.project_id && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        The folder name will be set to match the project's title.
                      </p>
                    )}
                  </label>
                )}
                <div className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Date range
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      aria-label="Start date"
                      value={folderModal.form.date_start}
                      onChange={(e) =>
                        setFolderModal({
                          ...folderModal,
                          form: { ...folderModal.form, date_start: e.target.value },
                        })
                      }
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    />
                    <span className="shrink-0 text-muted-foreground">–</span>
                    <input
                      type="date"
                      aria-label="End date"
                      value={folderModal.form.date_end}
                      onChange={(e) =>
                        setFolderModal({
                          ...folderModal,
                          form: { ...folderModal.form, date_end: e.target.value },
                        })
                      }
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between gap-2">
                {folderModal.editing ? (
                  <button
                    onClick={removeFolder}
                    className="text-xs font-medium text-destructive hover:underline"
                  >
                    Delete folder
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setFolderModal(null)}
                    className="h-9 rounded-md border border-border px-4 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveFolder}
                    className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
