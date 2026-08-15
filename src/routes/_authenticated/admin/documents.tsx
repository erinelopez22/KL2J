import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, FileText as FileIcon, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  addDocument,
  deleteDocument,
  addConfidentialDocument,
  deleteConfidentialDocument,
} from "@/lib/admin/documents.functions";
import { getConfidentialFileUrl } from "@/lib/admin/media.functions";
import { FileDrop } from "@/components/admin/FileDrop";
import { ConfidentialFileDrop } from "@/components/admin/ConfidentialFileDrop";
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

type ConfidentialDoc = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  storage_path: string;
  sort_order: number;
};

function AdminDocuments() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"public" | "confidential">("public");
  const doAdd = useServerFn(addDocument);
  const doDelete = useServerFn(deleteDocument);
  const doAddConfidential = useServerFn(addConfidentialDocument);
  const doDeleteConfidential = useServerFn(deleteConfidentialDocument);
  const doGetConfidentialUrl = useServerFn(getConfidentialFileUrl);
  const confirm = useConfirm();
  const [pending, setPending] = useState<{ url: string; path?: string } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"license" | "registration" | "other">("other");

  const [pendingConfidential, setPendingConfidential] = useState<{ path: string } | null>(null);
  const [confTitle, setConfTitle] = useState("");
  const [confDescription, setConfDescription] = useState("");
  const [confCategory, setConfCategory] = useState<"license" | "registration" | "other">("other");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["admin-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("sort_order");
      if (error) throw error;
      return data as Doc[];
    },
  });

  const { data: confidentialDocs, isLoading: isLoadingConfidential } = useQuery({
    queryKey: ["admin-confidential-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("confidential_documents")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as ConfidentialDoc[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    queryClient.invalidateQueries({ queryKey: ["public-documents"] });
  }

  function refreshConfidential() {
    queryClient.invalidateQueries({ queryKey: ["admin-confidential-documents"] });
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
    if (!(await confirm("Delete this document? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDelete({ data: { id: doc.id, storage_path: doc.storage_path ?? undefined } });
      toast.success("Document deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function saveConfidential() {
    if (!pendingConfidential || !confTitle.trim()) {
      toast.error("Upload a file and enter a title first");
      return;
    }
    try {
      await doAddConfidential({
        data: {
          title: confTitle.trim(),
          description: confDescription.trim() || undefined,
          category: confCategory,
          storage_path: pendingConfidential.path,
          sort_order: (confidentialDocs?.length ?? 0) + 1,
        },
      });
      toast.success("Confidential document saved");
      setPendingConfidential(null);
      setConfTitle("");
      setConfDescription("");
      setConfCategory("other");
      refreshConfidential();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save document");
    }
  }

  async function removeConfidential(doc: ConfidentialDoc) {
    if (
      !(await confirm("Delete this confidential document? This cannot be undone.", {
        destructive: true,
      }))
    )
      return;
    try {
      await doDeleteConfidential({ data: { id: doc.id, storage_path: doc.storage_path } });
      toast.success("Confidential document deleted");
      refreshConfidential();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function openConfidential(doc: ConfidentialDoc) {
    try {
      const { url } = await doGetConfidentialUrl({ data: { path: doc.storage_path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open file");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Licenses, registrations, and other business documents.
      </p>

      <div className="mt-4 flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("public")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "public"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Public documents
        </button>
        <button
          type="button"
          onClick={() => setTab("confidential")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "confidential"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-3.5 w-3.5" /> Confidential documents
        </button>
      </div>

      {tab === "public" ? (
        <div className="pt-6">
          <p className="text-sm text-muted-foreground">Shown publicly on the site.</p>

          <div className="mt-4 max-w-md rounded-xl border border-border bg-card p-4">
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
          {!isLoading && docs?.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground/70">No public documents yet.</p>
          )}

          <div className="mt-6 max-h-[calc(100vh-420px)] space-y-2 overflow-y-auto pr-1">
            {docs?.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {d.title}
                    </a>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {d.category}
                    </span>
                  </div>
                  {d.description && (
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                  )}
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
      ) : (
        <div className="pt-6">
          <p className="text-sm text-muted-foreground">
            Admin-only files — never shown or accessible on the public site.
          </p>

          <div className="mt-4 max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <ConfidentialFileDrop
              label={
                pendingConfidential
                  ? "File ready — fill details below"
                  : "Upload a confidential document"
              }
              onUploaded={setPendingConfidential}
            />
            <div className="mt-3 grid gap-3">
              <input
                placeholder="Title"
                value={confTitle}
                onChange={(e) => setConfTitle(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                rows={2}
                value={confDescription}
                onChange={(e) => setConfDescription(e.target.value)}
                className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={confCategory}
                onChange={(e) => setConfCategory(e.target.value as typeof confCategory)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="license">License</option>
                <option value="registration">Registration</option>
                <option value="other">Other</option>
              </select>
              <button
                onClick={saveConfidential}
                disabled={!pendingConfidential}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600/90 disabled:opacity-50"
              >
                Save confidential document
              </button>
            </div>
          </div>

          {isLoadingConfidential && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
          {!isLoadingConfidential && confidentialDocs?.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground/70">No confidential documents yet.</p>
          )}

          <div className="mt-6 max-h-[calc(100vh-420px)] space-y-2 overflow-y-auto pr-1">
            {confidentialDocs?.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
              >
                <Lock className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openConfidential(d)}
                      className="font-medium hover:underline"
                    >
                      {d.title}
                    </button>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {d.category}
                    </span>
                  </div>
                  {d.description && (
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                  )}
                </div>
                <button
                  onClick={() => removeConfidential(d)}
                  className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
