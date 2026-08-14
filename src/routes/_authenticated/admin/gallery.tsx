import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addGalleryPhoto, deleteGalleryPhoto } from "@/lib/admin/gallery.functions";
import { FileDrop } from "@/components/admin/FileDrop";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { AttachmentLightbox, type LightboxItem } from "@/components/AttachmentLightbox";

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
  created_at: string;
};

const SORT_OPTIONS = {
  upload_asc: { label: "Upload order", cmp: (a: Photo, b: Photo) => a.sort_order - b.sort_order },
  newest: { label: "Newest first", cmp: (a: Photo, b: Photo) => b.created_at.localeCompare(a.created_at) },
  oldest: { label: "Oldest first", cmp: (a: Photo, b: Photo) => a.created_at.localeCompare(b.created_at) },
  caption_asc: {
    label: "Caption A-Z",
    cmp: (a: Photo, b: Photo) => (a.caption ?? "").localeCompare(b.caption ?? ""),
  },
  caption_desc: {
    label: "Caption Z-A",
    cmp: (a: Photo, b: Photo) => (b.caption ?? "").localeCompare(a.caption ?? ""),
  },
} as const;
type SortKey = keyof typeof SORT_OPTIONS;

function AdminGallery() {
  const queryClient = useQueryClient();
  const doAdd = useServerFn(addGalleryPhoto);
  const doDelete = useServerFn(deleteGalleryPhoto);
  const confirm = useConfirm();
  const [sortKey, setSortKey] = useState<SortKey>("upload_asc");
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery_photos").select("*").order("sort_order");
      if (error) throw error;
      return data as Photo[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
    queryClient.invalidateQueries({ queryKey: ["public-gallery"] });
  }

  async function onUploaded(result: { url: string; path?: string; contentType: string }) {
    try {
      await doAdd({
        data: {
          url: result.url,
          storage_path: result.path,
          sort_order: (photos?.length ?? 0) + 1,
          media_type: result.contentType.startsWith("video/") ? "video" : "photo",
        },
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save photo");
    }
  }

  async function remove(photo: Photo) {
    if (!(await confirm("Delete this photo/video? This cannot be undone.", { destructive: true }))) return;
    try {
      await doDelete({ data: { id: photo.id, storage_path: photo.storage_path ?? undefined } });
      toast.success("Photo deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const sorted = useMemo(() => (photos ? [...photos].sort(SORT_OPTIONS[sortKey].cmp) : []), [photos, sortKey]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Gallery</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Field photos and videos shown in the public gallery section.
      </p>

      <div className="mt-6 max-w-sm">
        <FileDrop
          folder="gallery"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          label="Upload a photo or video"
          allowExternalLink={false}
          onUploaded={onUploaded}
        />
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && (
        <div className="mt-6 flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="gallery-sort">
            Sort by
          </label>
          <select
            id="gallery-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          >
            {Object.entries(SORT_OPTIONS).map(([key, opt]) => (
              <option key={key} value={key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid max-h-[calc(100vh-260px)] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() =>
              setLightbox({
                items: sorted.map((s) => ({
                  name: s.caption ?? "Gallery item",
                  kind: s.media_type === "video" ? "video" : "image",
                  resolveUrl: () => s.url,
                })),
                index: i,
              })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
            }}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-border"
          >
            {p.media_type === "video" ? (
              <>
                <video src={p.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/20">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                    <Play className="h-4 w-4 fill-slate-900 text-slate-900" />
                  </div>
                </div>
              </>
            ) : (
              <img src={p.url} alt={p.caption ?? "Gallery photo"} className="h-full w-full object-cover" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(p);
              }}
              className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Delete photo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {lightbox && (
        <AttachmentLightbox items={lightbox.items} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
