import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, FileText as FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addDocument, deleteDocument } from "@/lib/admin/documents.functions";
import { FileDrop } from "@/components/admin/FileDrop";
import { useConfirm } from "@/components/ConfirmDialogProvider";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: AdminDocuments,
});

type Doc = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string;
  storage_path: string | null;
  sort_order: number;
};

function AdminDocuments() {
  const queryClient = useQueryClient();
  const doAdd = useServerFn(addDocument);
  const doDelete = useServerFn(deleteDocument);
  const confirm = useConfirm();
  const [pending, setPending] = useState<{ url: string; path?: string } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"license" | "registration" | "other">("other");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["admin-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("sort_order");
      if (error) throw error;
      return data as Doc[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    queryClient.invalidateQueries({ queryKey: ["public-documents"] });
  }

  async function save() {
    if (!pending || !title.trim()) {
      toast.error("Upload a file and enter a title first");
      return;
    }
    try {
      await doAdd({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          url: pending.url,
          storage_path: pending.path,
          sort_order: (docs?.length ?? 0) + 1,
        },
      });
      toast.success("Document saved");
      setPending(null);
      setTitle("");
      setDescription("");
      setCategory("other");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save document");
    }
  }

  async function remove(doc: Doc) {
    if (!(await confirm("Delete this document? This cannot be undone.", { destructive: true }))) return;
    try {
      await doDelete({ data: { id: doc.id, storage_path: doc.storage_path ?? undefined } });
      toast.success("Document deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Licenses, registrations, and other business documents shown publicly.
      </p>

      <div className="mt-6 max-w-md rounded-xl border border-border bg-card p-4">
        <FileDrop
          folder="documents"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          label={pending ? "File ready — fill details below" : "Upload a document or image"}
          multiple={false}
          onUploaded={setPending}
        />
        <div className="mt-3 grid gap-3">
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          />
          <textarea
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="license">License</option>
            <option value="registration">Registration</option>
            <option value="other">Other</option>
          </select>
          <button
            onClick={save}
            disabled={!pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save document
          </button>
        </div>
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      <div className="mt-6 max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
        {docs?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <FileIcon className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  {d.title}
                </a>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {d.category}
                </span>
              </div>
              {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
            </div>
            <button
              onClick={() => remove(d)}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
