import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Send,
  RotateCcw,
  Loader2,
  X,
  ExternalLink,
  Search,
  Users2,
  UserX,
  Upload,
  Image as ImageIcon,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  deletePost,
  previewPostEmail,
  startPostSending,
  resumePausedPost,
  retryFailedRecipients,
  listSuppressedEmails,
} from "@/lib/admin/posts.functions";
import { SendProgress } from "@/components/admin/SendProgress";
import {
  addEmailContact,
  bulkImportEmailContacts,
  deleteEmailContact,
  updateEmailContact,
} from "@/lib/admin/email-contacts.functions";
import { parseContactsCsv } from "@/lib/admin/parseContactsCsv";
import { isValidEmail } from "@/lib/email";
import { checkPostContent } from "@/lib/admin/postContentPolicyCheck";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { ctaForPost } from "@/lib/postCta";
import {
  PostEditor,
  AttachmentTile,
  type PostRecord,
  type PostType,
} from "@/components/admin/PostEditor";
import { QuickImageUpload } from "@/components/admin/QuickImageUpload";
import { updateBranding } from "@/lib/admin/branding.functions";
import { usePublicSiteSettings } from "@/lib/public-content";

export const Route = createFileRoute("/_authenticated/admin/posts")({
  component: AdminPosts,
});

type PostRow = PostRecord & {
  status: "draft" | "sending" | "sent" | "paused";
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
};

const TYPE_LABELS: Record<PostType, string> = {
  project: "Project",
  service: "Service",
  profile: "Company profile",
  update: "Update",
  promotion: "Promotion",
  testimonial: "Testimonial",
  credentials: "Credentials",
  team: "Team",
  event: "Event",
  deadline: "Reminder",
  partnership: "Partnership",
};

const STATUS_STYLES: Record<PostRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  paused: "bg-destructive/10 text-destructive",
};

type PostRecipientRow = {
  id: string;
  email: string;
  name: string | null;
  source: "inquiry" | "custom";
  status: "pending" | "sending" | "sent" | "failed" | "paused";
  error: string | null;
  attempts: number;
  smtp_response: string | null;
  sent_at: string | null;
  created_at: string;
};

const RECIPIENT_STATUS_STYLES: Record<PostRecipientRow["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-destructive/10 text-destructive",
  paused: "bg-destructive/10 text-destructive",
};

function RecipientsModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { data: recipients, isLoading } = useQuery({
    queryKey: ["post-recipients", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_recipients")
        .select("id, email, name, source, status, error, attempts, smtp_response, sent_at, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as PostRecipientRow[];
    },
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Recipients{recipients ? ` (${recipients.length})` : ""}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && recipients && recipients.length === 0 && (
          <p className="text-sm text-muted-foreground">No recipients yet.</p>
        )}
        {!isLoading && recipients && recipients.length > 0 && (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
            {recipients.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name || r.email}</p>
                  {r.name && <p className="truncate text-xs text-muted-foreground">{r.email}</p>}
                  <p className="mt-0.5 text-[10px] uppercase text-muted-foreground/60">
                    {r.source === "inquiry" ? "From inquiry" : "Custom"}
                  </p>
                  {r.status === "failed" && r.error && (
                    <p className="mt-1 text-xs text-destructive">
                      {r.error}
                      {r.attempts >= 3 ? " (max attempts reached)" : ` (attempt ${r.attempts})`}
                    </p>
                  )}
                  {r.status === "paused" && (
                    <p className="mt-1 text-xs text-destructive">
                      Held — the send was paused for this post
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${RECIPIENT_STATUS_STYLES[r.status]}`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PostViewer({
  post,
  onClose,
  onEdit,
  onDuplicate,
  onDeleted,
  onChanged,
}: {
  post: PostRow;
  onClose: () => void;
  onEdit: (post: PostRow) => void;
  onDuplicate: (post: PostRow) => void;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const doDelete = useServerFn(deletePost);
  const doStartSending = useServerFn(startPostSending);
  const doResumePaused = useServerFn(resumePausedPost);
  const doRetryFailed = useServerFn(retryFailedRecipients);
  const [sendActive, setSendActive] = useState(post.status === "sending");
  const [showRecipients, setShowRecipients] = useState(false);
  const cta = ctaForPost(post.type, post.project_ids);

  async function handleDelete() {
    const message =
      post.status === "draft"
        ? "Delete this draft post?"
        : `Delete this post? It was already sent to ${post.sent_count} recipient(s) — this only removes it from the admin list, it does not unsend the email.`;
    if (!(await confirm(message, { destructive: true }))) return;
    try {
      await doDelete({ data: { id: post.id } });
      toast.success("Post deleted");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleSend() {
    if (post.total_count === 0) {
      toast.error("This post has no recipients — edit it and choose who to send to first.");
      return;
    }
    const policyIssues = checkPostContent(post.subject, post.body_html);
    if (policyIssues.length > 0) {
      if (
        !(await confirm(
          `This post may raise spam/policy concerns: ${policyIssues.map((i) => i.message).join(" ")}`,
          { title: "Possible policy concerns", confirmLabel: "Send anyway", cancelLabel: "Go back and edit" },
        ))
      ) {
        return;
      }
    }
    if (
      !(await confirm(
        `Queue this post to send to ${post.total_count} recipient(s)? It'll go out gradually in the background, not all at once.`,
      ))
    )
      return;
    try {
      await doStartSending({ data: { id: post.id } });
      setSendActive(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start sending");
    }
  }

  async function handleResume() {
    try {
      await doResumePaused({ data: { id: post.id } });
      setSendActive(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resume sending");
    }
  }

  async function handleRetryFailed() {
    try {
      const result = await doRetryFailed({ data: { id: post.id } });
      toast.success(`Retrying ${result.retried} recipient(s)`);
      setSendActive(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase text-primary">
                {TYPE_LABELS[post.type]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[post.status]}`}
              >
                {post.status}
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold">{post.title}</h2>
            <p className="text-xs text-muted-foreground">
              Created {new Date(post.created_at).toLocaleString()}
              {post.sent_at ? ` · Sent ${new Date(post.sent_at).toLocaleString()}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div
            className="[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_p]:my-1 text-sm"
            dangerouslySetInnerHTML={{ __html: post.body_html }}
          />

          {post.attachments.length > 0 && (
            <div
              className={`grid gap-1.5 ${
                post.attachments.length === 1
                  ? "grid-cols-1"
                  : post.attachments.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
              }`}
            >
              {post.attachments.map((a) => (
                <AttachmentTile key={a.url} a={a} />
              ))}
            </div>
          )}

          <a
            href={cta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm hover:bg-muted/50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ExternalLink className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{cta.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                Included in this post's email — {new URL(cta.url).hostname}
              </span>
            </span>
          </a>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/10 p-3 text-sm">
            <p className="font-medium">
              {post.sent_count}/{post.total_count} sent
              {post.failed_count > 0 ? `, ${post.failed_count} failed` : ""}
            </p>
            <button
              type="button"
              onClick={() => setShowRecipients(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Users2 className="h-3.5 w-3.5" /> Recipients ({post.total_count})
            </button>
          </div>

          {showRecipients && (
            <RecipientsModal postId={post.id} onClose={() => setShowRecipients(false)} />
          )}

          {sendActive && (
            <SendProgress
              post={post}
              onStatusChange={() => {
                setSendActive(false);
                onChanged();
              }}
            />
          )}

          {post.status === "paused" && !sendActive && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Sending paused</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gmail started rejecting sends, so the rest of this batch was held back instead of
                continuing to send into a possible block. Review the recipients below, then resume
                when ready.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {post.status === "draft" && !sendActive && (
              <>
                <button
                  onClick={() => onEdit(post)}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={handleSend}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="h-3.5 w-3.5" /> Send
                </button>
              </>
            )}
            {post.status === "paused" && !sendActive && (
              <button
                onClick={handleResume}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-3.5 w-3.5" /> Resume sending
              </button>
            )}
            {post.status === "sent" && post.failed_count > 0 && !sendActive && (
              <button
                onClick={handleRetryFailed}
                className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Resend failed
              </button>
            )}
            {post.status === "sent" && !sendActive && (
              <button
                onClick={() => onDuplicate(post)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
                title="Create a new draft with this post's content — recipients start empty"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Resend / Duplicate
              </button>
            )}
            <button
              onClick={handleDelete}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type EmailContact = { id: string; email: string; name: string | null; source: string; created_at: string };

function UnsubscribedModal({ onClose }: { onClose: () => void }) {
  const doList = useServerFn(listSuppressedEmails);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-email-suppressions"],
    queryFn: () => doList(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Unsubscribed</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These addresses opted out of Posts announcement emails and are automatically excluded from
              every future send.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No one has unsubscribed yet.</p>
        )}
        {!isLoading && rows && rows.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
              >
                <span className="truncate">{r.email}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(r.unsubscribed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmailListModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const doAdd = useServerFn(addEmailContact);
  const doBulkImport = useServerFn(bulkImportEmailContacts);
  const doDelete = useServerFn(deleteEmailContact);
  const doUpdate = useServerFn(updateEmailContact);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["admin-email-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailContact[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-email-contacts"] });
  }

  async function addOne() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address");
      return;
    }
    if (!isValidEmail(trimmed)) {
      toast.error("Enter a valid email address");
      return;
    }
    setAdding(true);
    try {
      await doAdd({ data: { email: trimmed, name: name.trim() || undefined } });
      setEmail("");
      setName("");
      refresh();
      toast.success("Contact added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setAdding(false);
    }
  }

  async function handleCsvUpload(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const { contacts: parsed, skipped: skippedInvalid } = parseContactsCsv(text);
      if (parsed.length === 0) {
        toast.error("No valid emails found in that file");
        return;
      }
      const result = await doBulkImport({ data: { contacts: parsed } });
      refresh();
      const notes = [
        result.skipped > 0 ? `${result.skipped} already on the list` : null,
        skippedInvalid > 0 ? `${skippedInvalid} invalid email${skippedInvalid === 1 ? "" : "s"} skipped` : null,
      ].filter(Boolean);
      toast.success(
        `Imported ${result.imported} contact${result.imported === 1 ? "" : "s"}` +
          (notes.length > 0 ? ` (${notes.join(", ")})` : ""),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function removeContact(contact: EmailContact) {
    if (!(await confirm(`Remove ${contact.email} from the list?`, { destructive: true }))) return;
    try {
      await doDelete({ data: { id: contact.id } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove contact");
    }
  }

  function startEdit(contact: EmailContact) {
    setEditingId(contact.id);
    setEditEmail(contact.email);
    setEditName(contact.name ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditEmail("");
    setEditName("");
  }

  async function saveEdit(contact: EmailContact) {
    const trimmed = editEmail.trim();
    if (!trimmed) {
      toast.error("Enter an email address");
      return;
    }
    if (!isValidEmail(trimmed)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSavingEdit(true);
    try {
      await doUpdate({ data: { id: contact.id, email: trimmed, name: editName.trim() || undefined } });
      cancelEdit();
      refresh();
      toast.success("Contact updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update contact");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Email list</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          A standing contact list, separate from inquiries — select "From email list" as a recipient
          source when composing a post.
        </p>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <label className="min-w-[160px] flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="someone@example.com"
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
            />
          </label>
          <label className="min-w-[120px] flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={addOne}
            disabled={adding}
            className="h-9 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Add
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Bulk import from CSV (columns: email, name)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvUpload(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {contacts?.length ?? 0} contact{contacts?.length === 1 ? "" : "s"}
          </p>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && contacts?.length === 0 && (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          )}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {contacts?.map((c) =>
              editingId === c.id ? (
                <div
                  key={c.id}
                  className="flex flex-wrap items-end gap-2 rounded-md border border-primary/40 bg-muted/30 px-2.5 py-2 text-sm"
                >
                  <label className="min-w-[160px] flex-1 text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
                    <input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      autoFocus
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                    />
                  </label>
                  <label className="min-w-[120px] flex-1 text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                    />
                  </label>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => saveEdit(c)}
                      disabled={savingEdit}
                      className="h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={savingEdit}
                      className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="block truncate font-medium">{c.name || c.email}</span>
                    {c.name && <span className="block truncate text-xs text-muted-foreground">{c.email}</span>}
                    {!isValidEmail(c.email) && (
                      <span className="mt-0.5 block text-xs font-medium text-destructive">
                        Invalid email — edit to fix
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-muted-foreground hover:text-primary"
                      aria-label={`Edit ${c.email}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContact(c)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${c.email}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const POST_SORT_OPTIONS = {
  newest: {
    label: "Newest first",
    cmp: (a: PostRow, b: PostRow) => b.created_at.localeCompare(a.created_at),
  },
  oldest: {
    label: "Oldest first",
    cmp: (a: PostRow, b: PostRow) => a.created_at.localeCompare(b.created_at),
  },
  title_asc: {
    label: "Title A-Z",
    cmp: (a: PostRow, b: PostRow) => a.title.localeCompare(b.title),
  },
} as const;
type PostSortKey = keyof typeof POST_SORT_OPTIONS;

function EmailPreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border p-3">
          <h3 className="text-sm font-semibold">Email preview</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <iframe title="Email preview" srcDoc={html} className="min-h-0 flex-1 bg-muted/30" />
      </div>
    </div>
  );
}

function EmailCoverPhotoModal({ onClose }: { onClose: () => void }) {
  const { data: settings } = usePublicSiteSettings();
  const queryClient = useQueryClient();
  const doUpdateBranding = useServerFn(updateBranding);
  const doPreviewEmail = useServerFn(previewPostEmail);
  const [saving, setSaving] = useState<string | null>(null);
  const [previewingType, setPreviewingType] = useState<PostType | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  async function preview(type: PostType) {
    setPreviewingType(type);
    try {
      const result = await doPreviewEmail({ data: { type } });
      setPreviewHtml(result.html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setPreviewingType(null);
    }
  }

  async function save(patch: Record<string, unknown>, key: string) {
    setSaving(key);
    try {
      await doUpdateBranding({ data: patch });
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  function setDefault(url: string | null) {
    return save({ email_cover_photo_url: url }, "default");
  }

  function setForType(type: PostType, url: string | null) {
    const current = { ...(settings?.email_cover_photo_by_type ?? {}) };
    if (url) current[type] = url;
    else delete current[type];
    return save({ email_cover_photo_by_type: current }, type);
  }

  function PhotoRow({
    label,
    url,
    fallbackNote,
    onUpload,
    onRemove,
    onPreview,
    busy,
    previewing,
  }: {
    label: string;
    url: string | null | undefined;
    fallbackNote?: string;
    onUpload: (url: string) => void;
    onRemove: () => void;
    onPreview: () => void;
    busy: boolean;
    previewing: boolean;
  }) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
        <div className="group/cover relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/cover:bg-black/50 group-hover/cover:opacity-100">
            <QuickImageUpload
              folder="branding"
              label="Change"
              iconOnly
              onUploaded={onUpload}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {!url && fallbackNote && <p className="text-xs text-muted-foreground">{fallbackNote}</p>}
        </div>
        <button
          type="button"
          disabled={previewing}
          onClick={onPreview}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          Preview
        </button>
        {url && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label={`Remove ${label} cover photo`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Email cover photo</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Shown at the top of every post email. Set a default that applies to all post types, or
          override it for specific types below.
        </p>

        <PhotoRow
          label="Default (all types)"
          url={settings?.email_cover_photo_url}
          onUpload={(url) => setDefault(url)}
          onRemove={() => setDefault(null)}
          onPreview={() => preview("update")}
          busy={saving === "default"}
          previewing={previewingType === "update"}
        />

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Per-type overrides</p>
          {(Object.keys(TYPE_LABELS) as PostType[]).map((type) => (
            <PhotoRow
              key={type}
              label={TYPE_LABELS[type]}
              url={settings?.email_cover_photo_by_type?.[type]}
              fallbackNote="Using default"
              onUpload={(url) => setForType(type, url)}
              onRemove={() => setForType(type, null)}
              onPreview={() => preview(type)}
              busy={saving === type}
              previewing={previewingType === type}
            />
          ))}
        </div>
      </div>
      {previewHtml && (
        <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />
      )}
    </div>
  );
}

function AdminPosts() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const doDelete = useServerFn(deletePost);
  const [filter, setFilter] = useState<"all" | PostRow["status"]>("all");
  const [editing, setEditing] = useState<PostRow | "new" | null>(null);
  const [duplicating, setDuplicating] = useState<PostRow | null>(null);
  const [viewing, setViewing] = useState<PostRow | null>(null);
  const [showEmailList, setShowEmailList] = useState(false);
  const [showCoverPhoto, setShowCoverPhoto] = useState(false);
  const [showUnsubscribed, setShowUnsubscribed] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<PostSortKey>("newest");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PostRow[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
  }


  async function remove(post: PostRow) {
    const message =
      post.status === "draft"
        ? "Delete this draft post?"
        : `Delete this post? It was already sent to ${post.sent_count} recipient(s) — this only removes it from the admin list, it does not unsend the email.`;
    if (!(await confirm(message, { destructive: true }))) return;
    try {
      await doDelete({ data: { id: post.id } });
      toast.success("Post deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const all = posts ?? [];
  const counts = {
    all: all.length,
    draft: all.filter((p) => p.status === "draft").length,
    sending: all.filter((p) => p.status === "sending").length,
    sent: all.filter((p) => p.status === "sent").length,
  };
  const searchLower = search.trim().toLowerCase();
  const filtered = (filter === "all" ? all : all.filter((p) => p.status === filter))
    .filter((p) => !searchLower || p.title.toLowerCase().includes(searchLower))
    .sort(POST_SORT_OPTIONS[sortKey].cmp);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="h-6 w-6 text-primary" /> Posts
          </h1>
          <p className="text-sm text-muted-foreground">
            Announce new projects, services, or company updates by email to your customers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCoverPhoto(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <ImageIcon className="h-4 w-4" /> Email cover photo
          </button>
          <button
            type="button"
            onClick={() => setShowEmailList(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Users2 className="h-4 w-4" /> Email list
          </button>
          <button
            type="button"
            onClick={() => setShowUnsubscribed(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <UserX className="h-4 w-4" /> Unsubscribed
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New post
          </button>
        </div>
      </div>
      {showEmailList && <EmailListModal onClose={() => setShowEmailList(false)} />}
      {showUnsubscribed && <UnsubscribedModal onClose={() => setShowUnsubscribed(false)} />}
      {showCoverPhoto && <EmailCoverPhotoModal onClose={() => setShowCoverPhoto(false)} />}

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "draft", "sending", "sent"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
              filter === f
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title…"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as PostSortKey)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          {Object.entries(POST_SORT_OPTIONS).map(([key, opt]) => (
            <option key={key} value={key}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No posts match your search or filter.
        </div>
      )}

      <div className="mt-6 max-h-[calc(100vh-380px)] space-y-2 overflow-y-auto pr-1">
        {filtered.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => setViewing(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setViewing(p);
            }}
            className="cursor-pointer rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase text-primary">
                    {TYPE_LABELS[p.type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[p.status]}`}
                  >
                    {p.status}
                  </span>
                  <span className="font-medium">{p.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.sent_count}/{p.total_count} sent
                  {p.failed_count > 0 ? `, ${p.failed_count} failed` : ""} ·{" "}
                  {new Date(p.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(p);
                }}
                className="shrink-0 flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {viewing && (
        <PostViewer
          post={viewing}
          onClose={() => setViewing(null)}
          onEdit={(p) => {
            setViewing(null);
            setEditing(p);
          }}
          onDuplicate={(p) => {
            setViewing(null);
            setDuplicating(p);
          }}
          onDeleted={() => {
            setViewing(null);
            refresh();
          }}
          onChanged={refresh}
        />
      )}

      {editing && (
        <PostEditor
          post={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {duplicating && (
        <PostEditor
          duplicateFrom={duplicating}
          onClose={() => setDuplicating(null)}
          onSaved={() => {
            setDuplicating(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
