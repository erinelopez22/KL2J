import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addGalleryPhoto, deleteGalleryPhoto } from "@/lib/admin/gallery.functions";
import { FileDrop } from "@/components/admin/FileDrop";

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
};

function AdminGallery() {
  const queryClient = useQueryClient();
  const doAdd = useServerFn(addGalleryPhoto);
  const doDelete = useServerFn(deleteGalleryPhoto);

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

  async function onUploaded(result: { url: string; path: string; contentType: string }) {
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
    try {
      await doDelete({ data: { id: photo.id, storage_path: photo.storage_path ?? undefined } });
      toast.success("Photo deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

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
          onUploaded={onUploaded}
        />
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      <div className="mt-6 grid max-h-[calc(100vh-260px)] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
        {photos?.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
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
              onClick={() => remove(p)}
              className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Delete photo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
