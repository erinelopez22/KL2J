import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProjectFormModal } from "@/components/admin/ProjectFormModal";
import { getConfidentialFileUrl, createConfidentialUploadUrl } from "@/lib/admin/media.functions";
import {
  updateInquiryStatus,
  createInquiry,
  addAdminInquiryComment,
  deleteInquiry,
  markInquiryCommentsRead,
  MANUAL_INQUIRY_CHANNELS,
  type ManualInquiryChannel,
} from "@/lib/admin/inquiries.functions";
import { usePublicServices } from "@/lib/public-content";
import { mergeChecklists } from "@/lib/serviceChecklist";
import { useRealtimeInvalidate } from "@/lib/useRealtimeInvalidate";
import { LocationAutosuggest } from "@/components/LocationAutosuggest";
import { PublicDocumentUpload, type UploadedDocument } from "@/components/PublicDocumentUpload";
import { uploadFileDirect } from "@/lib/adminDirectUpload";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { isOversizedFile, MAX_ADMIN_UPLOAD_BYTES } from "@/lib/uploadLimits";
import { OversizeFileLinkPrompt } from "@/components/OversizeFileLinkPrompt";
import { AttachmentLightbox, kindFromContentType, type LightboxItem } from "@/components/AttachmentLightbox";
import {
  MessageCircle,
  RefreshCw,
  Search,
  Clock,
  MailWarning,
  Eye,
  EyeOff,
  X,
  FolderKanban,
  Plus,
  Mail,
  MessageSquare,
  Globe,
  Bot,
  UserPlus,
  Phone,
  Facebook,
  CheckCircle2,
  Circle,
  ListChecks,
  FileText,
  Paperclip,
  LayoutGrid,
  List,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/inquiries")({
  component: AdminInquiries,
});

const STATUS_COLUMNS = ["New", "Ongoing", "Onhold", "Completed"] as const;
const HIDDEN_COLUMNS = ["Rejected", "Cancelled"] as const;
type Status = (typeof STATUS_COLUMNS)[number] | (typeof HIDDEN_COLUMNS)[number];
const ALL_STATUSES = [...STATUS_COLUMNS, ...HIDDEN_COLUMNS];

const STATUS_HEADER_STYLES: Record<Status, string> = {
  New: "border-t-blue-500",
  Ongoing: "border-t-indigo-500",
  Onhold: "border-t-amber-500",
  Completed: "border-t-emerald-500",
  Rejected: "border-t-destructive",
  Cancelled: "border-t-muted-foreground",
};

const STATUS_BADGE_STYLES: Record<Status, string> = {
  New: "bg-blue-100 text-blue-700",
  Ongoing: "bg-indigo-100 text-indigo-700",
  Onhold: "bg-amber-100 text-amber-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-destructive/10 text-destructive",
  Cancelled: "bg-muted text-muted-foreground",
};

type ChecklistResponse = {
  id: string;
  label: string;
  type: "text" | "number" | "location" | "checkbox" | "document";
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: { path: string; name: string; contentType: string; isExternalLink?: boolean }[];
};

type Inquiry = {
  id: string;
  created_at: string;
  inquiry_code: string | null;
  name: string;
  contact: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  services: string[];
  message: string | null;
  channel: string | null;
  checklist_responses: ChecklistResponse[];
  attachments: CommentAttachment[];
  status: Status;
  email_sent: boolean;
  email_error: string | null;
};

type LinkedProject = { id: string; title: string; is_public: boolean };

function inquiryServices(inquiry: Pick<Inquiry, "service" | "services">): string[] {
  return inquiry.services?.length > 0 ? inquiry.services : inquiry.service ? [inquiry.service] : [];
}

function InquiryCard({
  inquiry,
  onOpen,
  unreadCount,
}: {
  inquiry: Inquiry;
  onOpen: () => void;
  unreadCount?: number;
}) {
  return (
    <div
      onClick={onOpen}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", inquiry.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm hover:border-primary/40 active:cursor-grabbing"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold">{inquiry.name}</span>
        {inquiry.channel && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            {inquiry.channel}
          </span>
        )}
        {!!unreadCount && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-semibold text-destructive-foreground">
            <MessageSquare className="h-2.5 w-2.5" /> {unreadCount}
          </span>
        )}
        {!inquiry.email_sent && (
          <span
            title={inquiry.email_error ?? "Notification email failed to send"}
            className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-destructive"
          >
            <MailWarning className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {[inquiry.email, inquiry.phone].filter(Boolean).join(" · ") || inquiry.contact}
      </div>
      {inquiryServices(inquiry).length > 0 && (
        <div className="mt-1 text-xs font-medium text-primary">{inquiryServices(inquiry).join(", ")}</div>
      )}
      {inquiry.checklist_responses?.length > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <ListChecks className="h-3 w-3" />
          {inquiry.checklist_responses.filter((c) => c.checked || c.answer?.trim() || c.hasDocument || c.documents?.length).length}/
          {inquiry.checklist_responses.length} details provided
        </div>
      )}
      {inquiry.message && <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{inquiry.message}</p>}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {new Date(inquiry.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

function StatusColumn({
  status,
  items,
  onOpen,
  onDropInquiry,
  unreadCounts,
}: {
  status: Status;
  items: Inquiry[];
  onOpen: (i: Inquiry) => void;
  onDropInquiry: (id: string, status: Status) => void;
  unreadCounts: Record<string, number>;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`flex h-full w-[85vw] max-w-[300px] shrink-0 snap-start flex-col rounded-lg border-t-4 bg-muted/30 sm:w-[260px] sm:max-w-none ${STATUS_HEADER_STYLES[status]} ${dragOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold">{status}</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const id = e.dataTransfer.getData("text/plain");
          if (id) onDropInquiry(id, status);
        }}
        className="flex-1 space-y-2 overflow-y-auto px-2 pb-2"
        style={{ minHeight: 80 }}
      >
        {items.map((i) => (
          <InquiryCard key={i.id} inquiry={i} onOpen={() => onOpen(i)} unreadCount={unreadCounts[i.id]} />
        ))}
      </div>
    </div>
  );
}

function InquiryListRow({
  inquiry,
  onOpen,
  onStatusChange,
  unreadCount,
  statusOptions,
}: {
  inquiry: Inquiry;
  onOpen: () => void;
  onStatusChange: (status: Status) => void;
  unreadCount?: number;
  statusOptions: readonly Status[];
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold">{inquiry.name}</span>
          {inquiry.channel && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
              {inquiry.channel}
            </span>
          )}
          {!!unreadCount && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              <MessageSquare className="h-2.5 w-2.5" /> {unreadCount}
            </span>
          )}
          {!inquiry.email_sent && (
            <span
              title={inquiry.email_error ?? "Notification email failed to send"}
              className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-destructive"
            >
              <MailWarning className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {[inquiry.email, inquiry.phone].filter(Boolean).join(" · ") || inquiry.contact}
          {inquiryServices(inquiry).length > 0 && (
            <span className="ml-2 font-medium text-primary">{inquiryServices(inquiry).join(", ")}</span>
          )}
        </div>
        {inquiry.message && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{inquiry.message}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {new Date(inquiry.created_at).toLocaleDateString()}
      </div>
      <select
        value={inquiry.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(e.target.value as Status)}
        className={`shrink-0 rounded-full border-0 px-2.5 py-1 text-[11px] font-medium uppercase ${STATUS_BADGE_STYLES[inquiry.status]}`}
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function LinkedProjectSection({ inquiry }: { inquiry: Inquiry }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: linkedProject, isLoading } = useQuery({
    queryKey: ["inquiry-project", inquiry.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, is_public")
        .eq("inquiry_id", inquiry.id)
        .maybeSingle();
      if (error) throw error;
      return data as LinkedProject | null;
    },
  });

  function handleSaved() {
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["inquiry-project", inquiry.id] });
    queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    queryClient.invalidateQueries({ queryKey: ["public-projects"] });
  }

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading linked project…</p>;

  if (linkedProject) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium">{linkedProject.title}</span>
          {linkedProject.is_public && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-700">
              Public
            </span>
          )}
        </div>
        <Link to="/admin/projects" className="shrink-0 text-primary hover:underline">
          Manage →
        </Link>
      </div>
    );
  }

  if (inquiry.status === "Rejected" || inquiry.status === "Cancelled") {
    return (
      <p className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
        {inquiry.status} inquiries can't be linked to a project.
      </p>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" /> Create linked project
      </button>
      {showForm && (
        <ProjectFormModal
          project={null}
          defaultInquiry={{
            id: inquiry.id,
            label: `${inquiry.name} · ${inquiry.contact}`,
            name: inquiry.name,
            services: inquiryServices(inquiry),
            checklist_responses: inquiry.checklist_responses,
          }}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

function parseInquiryMessage(message: string | null): { phone: string | null; details: string | null } {
  if (!message) return { phone: null, details: null };
  const match = message.match(/^Phone:\s*(.+?)\n\n([\s\S]*)$/);
  if (match) return { phone: match[1].trim(), details: match[2].trim() || null };
  return { phone: null, details: message };
}

function platformLabel(channel: string | null): { label: string; icon: typeof Globe } {
  if (channel === "quote_form") return { label: "Request a Quote form", icon: Globe };
  if (channel === "referral") return { label: "Referral", icon: Phone };
  if (channel === "facebook") return { label: "Facebook Messenger", icon: Facebook };
  if (channel === "others") return { label: "Other", icon: UserPlus };
  // "manual" is a legacy value from before channel tagging was required —
  // kept so inquiries created before this change still show sensibly.
  if (channel === "manual") return { label: "Added by admin", icon: UserPlus };
  if (channel) return { label: "Chatbot", icon: Bot };
  return { label: "Unknown", icon: Globe };
}

function emailComposeUrl(to: string, subject: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;
}

type CommentAttachment = { path: string; name: string; contentType: string; isExternalLink?: boolean };
type InquiryComment = {
  id: string;
  author_type: "admin" | "inquirer";
  author_name: string | null;
  message: string | null;
  attachments: CommentAttachment[];
  created_at: string;
};

function AttachButton({ onUploaded }: { onUploaded: (result: CommentAttachment) => void }) {
  const [busy, setBusy] = useState(false);
  const [oversizeQueue, setOversizeQueue] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const mint = useServerFn(createConfidentialUploadUrl);

  async function handleFiles(files: FileList) {
    const okFiles: File[] = [];
    const oversized: File[] = [];
    for (const file of Array.from(files)) {
      (isOversizedFile(file, MAX_ADMIN_UPLOAD_BYTES) ? oversized : okFiles).push(file);
    }
    if (oversized.length > 0) setOversizeQueue((q) => [...q, ...oversized]);
    if (okFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      for (const file of okFiles) {
        const result = await uploadFileDirect(mint, "confidential-media", file);
        onUploaded({ path: result.path, contentType: result.contentType, name: file.name });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (oversizeQueue.length > 0) {
    return (
      <OversizeFileLinkPrompt
        fileName={oversizeQueue[0].name}
        maxMB={Math.round(MAX_ADMIN_UPLOAD_BYTES / 1024 / 1024)}
        onCancel={() => setOversizeQueue((q) => q.slice(1))}
        onSave={(link) => {
          const file = oversizeQueue[0];
          onUploaded({ path: link, contentType: file.type, name: file.name, isExternalLink: true });
          setOversizeQueue((q) => q.slice(1));
        }}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
      >
        <Paperclip className="h-4 w-4" /> {busy ? "Uploading…" : "Attach"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
        }}
      />
    </>
  );
}

function AdminCommentComposer({ inquiryId, onSent }: { inquiryId: string; onSent: () => void }) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const doAddComment = useServerFn(addAdminInquiryComment);

  function removeAttachment(path: string) {
    setAttachments((a) => a.filter((x) => x.path !== path));
  }

  async function send() {
    if (!message.trim() && attachments.length === 0) {
      toast.error("Write a message or attach a file");
      return;
    }
    setSending(true);
    try {
      await doAddComment({ data: { inquiryId, message: message.trim() || undefined, attachments } });
      setMessage("");
      setAttachments([]);
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write a message to the inquirer…"
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span key={a.path} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {a.name}
              <button type="button" onClick={() => removeAttachment(a.path)} aria-label={`Remove ${a.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <AttachButton onUploaded={(a) => setAttachments((cur) => [...cur, a])} />
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

function InquiryCommentsTab({ inquiryId }: { inquiryId: string }) {
  const queryClient = useQueryClient();
  const doGetUrl = useServerFn(getConfidentialFileUrl);
  const doMarkRead = useServerFn(markInquiryCommentsRead);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const {
    data: comments,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["inquiry-comments", inquiryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiry_comments")
        .select("id, author_type, author_name, message, attachments, created_at")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as InquiryComment[];
    },
  });
  useRealtimeInvalidate("inquiry_comments", [["inquiry-comments", inquiryId]], {
    filter: `inquiry_id=eq.${inquiryId}`,
  });

  useEffect(() => {
    doMarkRead({ data: { inquiryId } })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-notif-messages"] });
        queryClient.invalidateQueries({ queryKey: ["admin-inquiries-unread-counts"] });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  function openAttachments(docs: CommentAttachment[], startIndex: number) {
    const items: LightboxItem[] = docs.map((d) => ({
      name: d.name,
      kind: kindFromContentType(d.contentType, d.isExternalLink),
      resolveUrl: () =>
        d.isExternalLink ? d.path : doGetUrl({ data: { path: d.path } }).then((r) => r.url),
    }));
    setLightbox({ items, index: startIndex });
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
      <div className="max-h-[40vh] min-h-[120px] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && comments?.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {comments?.map((c) => (
          <div key={c.id} className={`flex ${c.author_type === "admin" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                c.author_type === "admin" ? "bg-primary text-primary-foreground" : "border border-border bg-card"
              }`}
            >
              <div
                className={`mb-0.5 text-[10px] font-medium uppercase ${
                  c.author_type === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {c.author_type === "admin" ? "You" : c.author_name || "Inquirer"} ·{" "}
                {new Date(c.created_at).toLocaleString()}
              </div>
              {c.message && <p className="whitespace-pre-wrap leading-relaxed">{c.message}</p>}
              {c.attachments?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.attachments.map((a, i) => (
                    <button
                      key={a.path}
                      type="button"
                      onClick={() => openAttachments(c.attachments, i)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                        c.author_type === "admin"
                          ? "bg-primary-foreground/15 hover:bg-primary-foreground/25"
                          : "bg-muted hover:bg-muted/70"
                      }`}
                    >
                      <FileText className="h-3 w-3" /> {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <AdminCommentComposer inquiryId={inquiryId} onSent={() => refetch()} />
      {lightbox && (
        <AttachmentLightbox items={lightbox.items} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function InquiryDetail({
  inquiry,
  onClose,
  onDeleted,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  // Newer inquiries have dedicated email/phone columns. Older rows only have
  // "contact" (email or phone, whichever the customer entered) with the
  // phone sometimes embedded as a "Phone: ..." prefix in the message.
  const hasDedicatedFields = Boolean(inquiry.email || inquiry.phone);
  const legacy = parseInquiryMessage(inquiry.message);
  const contactIsEmail = inquiry.contact.includes("@");
  const email = inquiry.email || (!hasDedicatedFields && contactIsEmail ? inquiry.contact : null);
  const phone = inquiry.phone || legacy.phone || (!hasDedicatedFields && !contactIsEmail ? inquiry.contact : null);
  const details = hasDedicatedFields ? inquiry.message : legacy.details;
  const platform = platformLabel(inquiry.channel);
  const doGetConfidentialUrl = useServerFn(getConfidentialFileUrl);
  const doDeleteInquiry = useServerFn(deleteInquiry);
  const [tab, setTab] = useState<"details" | "comments" | "attachments">("details");
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  function openAttachments(docs: { path: string; name: string; contentType?: string; isExternalLink?: boolean }[], startIndex: number) {
    const items: LightboxItem[] = docs.map((d) => ({
      name: d.name,
      kind: kindFromContentType(d.contentType ?? "", d.isExternalLink),
      resolveUrl: () =>
        d.isExternalLink ? d.path : doGetConfidentialUrl({ data: { path: d.path } }).then((r) => r.url),
    }));
    setLightbox({ items, index: startIndex });
  }

  async function emailInquirer() {
    if (!email) return;
    if (await confirm(`Send an email to: ${inquiry.name} (${email})?`)) {
      window.open(
        emailComposeUrl(email, `Re: Your inquiry to KL2J`),
        "_blank",
        "noopener,noreferrer,width=900,height=650",
      );
    }
  }

  async function smsInquirer() {
    if (!phone) return;
    if (await confirm(`Send an SMS to: ${inquiry.name} (${phone})?`)) {
      // sms: is a custom URI scheme handled by the OS's default messaging
      // app (if one is registered) — it must be a direct navigation, not
      // window.open, same as how tel: links work elsewhere in this app.
      window.location.href = `sms:${phone}`;
    }
  }

  async function handleDelete() {
    const { data: linked } = await supabase
      .from("projects")
      .select("id, title")
      .eq("inquiry_id", inquiry.id)
      .maybeSingle();
    const warning = linked
      ? ` The project "${linked.title}" is linked to it — it will stay, just unlinked.`
      : "";
    if (
      !(await confirm(`Delete this inquiry? This cannot be undone.${warning}`, { destructive: true }))
    )
      return;
    setDeleting(true);
    try {
      await doDeleteInquiry({ data: { id: inquiry.id } });
      toast.success("Inquiry deleted");
      onDeleted(inquiry.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[inquiry.status]}`}
          >
            {inquiry.status}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              aria-label="Delete inquiry"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {inquiry.inquiry_code && (
          <div className="mt-2 text-xs text-muted-foreground">
            Inquiry Code: <span className="font-mono font-semibold text-foreground">{inquiry.inquiry_code}</span>
          </div>
        )}

        <div className="mt-3 flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("details")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "details"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setTab("comments")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "comments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Comments
          </button>
          <button
            type="button"
            onClick={() => setTab("attachments")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "attachments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Attachments
          </button>
        </div>

        {tab === "comments" && <InquiryCommentsTab inquiryId={inquiry.id} />}

        {tab === "details" && (
        <>
        {inquiryServices(inquiry).length > 0 && (
          <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2.5">
            <span className="text-sm font-bold text-primary">
              Service Type : {inquiryServices(inquiry).join(", ")}
            </span>
          </div>
        )}

        <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
          <div className="grid grid-cols-[45%_1fr] items-center gap-3 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Customer Name</span>
            <span className="font-semibold">{inquiry.name}</span>
          </div>
          {email && (
            <button
              type="button"
              onClick={emailInquirer}
              className="grid w-full grid-cols-[45%_1fr] items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
            >
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <span className="flex min-w-0 items-center gap-1.5 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-all">{email}</span>
              </span>
            </button>
          )}
          {phone && (
            <button
              type="button"
              onClick={smsInquirer}
              className="grid w-full grid-cols-[45%_1fr] items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
            >
              <span className="text-xs font-medium text-muted-foreground">Number</span>
              <span className="flex min-w-0 items-center gap-1.5 text-primary hover:underline">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-all">{phone}</span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-[45%_1fr] items-center gap-3 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Platform</span>
            <span className="flex items-center gap-1.5">
              <platform.icon className="h-3.5 w-3.5 text-muted-foreground" /> {platform.label}
            </span>
          </div>
          {details && (
            <div className="px-3 py-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Inquiry details</span>
              <p className="whitespace-pre-wrap leading-relaxed">{details}</p>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(inquiry.created_at).toLocaleString()}
          </span>
        </div>

        {!inquiry.email_sent && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            <MailWarning className="h-3.5 w-3.5" />
            {inquiry.email_error ?? "Notification email failed to send"}
          </div>
        )}

        {inquiry.checklist_responses?.length > 0 && (
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
            <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-2">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">Supporting documents</span>
            </div>
            {inquiry.checklist_responses.map((c) => (
              <div key={c.id} className="grid grid-cols-[45%_1fr] items-start gap-3 px-3 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                {c.type === "checkbox" && (
                  <span className="inline-flex items-center gap-1.5">
                    {c.checked ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={c.checked ? "font-medium text-emerald-700" : "text-muted-foreground"}>
                      {c.checked ? "Yes" : "No"}
                    </span>
                  </span>
                )}
                {c.type === "document" &&
                  (c.documents && c.documents.length > 0 ? (
                    <span className="font-medium text-emerald-700">
                      Yes — {c.documents.length} file{c.documents.length === 1 ? "" : "s"} (see Attachments)
                    </span>
                  ) : c.hasDocument ? (
                    <span className="font-medium text-emerald-700">Yes (not uploaded)</span>
                  ) : (
                    <span className="text-muted-foreground/60">No</span>
                  ))}
                {c.type !== "checkbox" && c.type !== "document" && (
                  <span className={c.answer?.trim() ? "font-medium" : "text-muted-foreground/60"}>
                    {c.answer?.trim() || "—"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3">
          <LinkedProjectSection inquiry={inquiry} />
        </div>
        </>
        )}

        {tab === "attachments" && (
        <>
        {inquiry.checklist_responses?.filter((c) => c.type === "document" && c.documents && c.documents.length > 0)
          .length > 0 && (
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
            <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-2">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">Supporting documents</span>
            </div>
            {inquiry.checklist_responses
              .filter((c) => c.type === "document" && c.documents && c.documents.length > 0)
              .map((c) => (
                <div key={c.id} className="grid grid-cols-[45%_1fr] items-start gap-3 px-3 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {c.documents!.map((doc, i) => (
                      <button
                        key={doc.path}
                        type="button"
                        onClick={() => openAttachments(c.documents!, i)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
                      >
                        <FileText className="h-3.5 w-3.5" /> {doc.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="mt-3">
          <span className="text-xs font-semibold uppercase text-muted-foreground/70">
            All files (checklist + comments)
          </span>
          {inquiry.attachments?.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {inquiry.attachments.map((a, i) => (
                <button
                  key={a.path}
                  type="button"
                  onClick={() => openAttachments(inquiry.attachments, i)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
                >
                  <FileText className="h-3.5 w-3.5" /> {a.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">No files shared yet.</p>
          )}
        </div>
        </>
        )}
      </div>
      {lightbox && (
        <AttachmentLightbox items={lightbox.items} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

type ManualChecklistAnswer = {
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: UploadedDocument[];
};

const MANUAL_CHANNEL_LABELS: Record<ManualInquiryChannel, string> = {
  referral: "Referral",
  facebook: "Facebook",
  others: "Others",
};

function NewInquiryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [channel, setChannel] = useState<ManualInquiryChannel | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, ManualChecklistAnswer>>({});
  const [saving, setSaving] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const doCreate = useServerFn(createInquiry);
  const { data: services } = usePublicServices();
  const selectedServiceChecklist = mergeChecklists(services ?? [], selectedServices);

  function toggleService(title: string) {
    setSelectedServices((prev) => (prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]));
    setChecklistAnswers({});
  }

  function updateChecklistAnswer(id: string, patch: ManualChecklistAnswer) {
    setChecklistAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  }

  async function submit() {
    if (!channel) {
      toast.error("Select how the customer reached out");
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("Provide an email or phone number");
      return;
    }
    setSaving(true);
    try {
      const result = await doCreate({
        data: {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          services: selectedServices,
          channel,
          message: message.trim() || undefined,
          checklist_responses: selectedServiceChecklist.map((item) => ({
            id: item.id,
            label: item.label,
            type: item.type,
            checked: checklistAnswers[item.id]?.checked,
            answer: checklistAnswers[item.id]?.answer,
            hasDocument: checklistAnswers[item.id]?.hasDocument ?? false,
            documents: checklistAnswers[item.id]?.documents ?? [],
          })),
        },
      });
      toast.success("Inquiry created");
      setCreatedCode(result.inquiryCode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create inquiry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New inquiry</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {createdCode ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">Inquiry created. Share this code with the client:</p>
            <p className="mt-3 rounded-lg bg-secondary/40 py-4 text-2xl font-bold tracking-wide text-primary">
              {createdCode}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {"They can use it on the public \"My Inquirie(s)\" page to check status or message us."}
            </p>
            <button
              type="button"
              onClick={onCreated}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        ) : (
        <>
        <p className="mb-4 text-xs text-muted-foreground">
          For clients who reached out directly (phone, walk-in, etc.) instead of through the website.
        </p>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              How did the customer reach out? <span className="text-destructive">(required)</span>
            </span>
            <div className="flex gap-1.5">
              {MANUAL_INQUIRY_CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    channel === c
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {MANUAL_CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Name <span className="text-destructive">(required)</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground/70">Provide at least an email or phone number.</p>
          <div className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Services</span>
            <div className="flex flex-wrap gap-2">
              {services?.map((s) => {
                const checked = selectedServices.includes(s.title);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.title)}
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
          {selectedServiceChecklist.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                A few details for this service
              </p>
              <div className="space-y-3">
                {selectedServiceChecklist.map((item) => {
                  const a = checklistAnswers[item.id] ?? {};
                  if (item.type === "checkbox") {
                    return (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(a.checked)}
                          onChange={() => updateChecklistAnswer(item.id, { checked: !a.checked })}
                        />
                        {item.label}
                      </label>
                    );
                  }
                  if (item.type === "document") {
                    return (
                      <PublicDocumentUpload
                        key={item.id}
                        label={item.label}
                        value={{ hasDocument: Boolean(a.hasDocument), documents: a.documents ?? [] }}
                        onChange={(next) => updateChecklistAnswer(item.id, next)}
                      />
                    );
                  }
                  if (item.type === "location") {
                    return (
                      <div key={item.id}>
                        <span className="mb-1 block text-xs text-muted-foreground">{item.label}</span>
                        <LocationAutosuggest
                          value={a.answer ?? ""}
                          onChange={(v) => updateChecklistAnswer(item.id, { answer: v })}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={item.id}>
                      <span className="mb-1 block text-xs text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type={item.type === "number" ? "number" : "text"}
                          value={a.answer ?? ""}
                          onChange={(e) => updateChecklistAnswer(item.id, { answer: e.target.value })}
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        />
                        {item.unit && <span className="shrink-0 text-sm text-muted-foreground">{item.unit}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Message / details</span>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create inquiry"}
          </button>
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

const INQUIRY_SORT_OPTIONS = {
  newest: { label: "Newest first", cmp: (a: Inquiry, b: Inquiry) => b.created_at.localeCompare(a.created_at) },
  oldest: { label: "Oldest first", cmp: (a: Inquiry, b: Inquiry) => a.created_at.localeCompare(b.created_at) },
  name_asc: { label: "Name A-Z", cmp: (a: Inquiry, b: Inquiry) => a.name.localeCompare(b.name) },
  service_asc: {
    label: "Service A-Z",
    cmp: (a: Inquiry, b: Inquiry) =>
      inquiryServices(a).join(", ").localeCompare(inquiryServices(b).join(", ")),
  },
} as const;
type InquirySortKey = keyof typeof INQUIRY_SORT_OPTIONS;

function AdminInquiries() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [openInquiryId, setOpenInquiryId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [sortKey, setSortKey] = useState<InquirySortKey>("newest");
  const doUpdateStatus = useServerFn(updateInquiryStatus);
  const queryClient = useQueryClient();

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setItems((data as unknown as Inquiry[]) ?? []);
    setLoading(false);
  }

  const { data: unreadCounts = {} } = useQuery({
    queryKey: ["admin-inquiries-unread-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiry_comments")
        .select("inquiry_id")
        .eq("author_type", "inquirer")
        .eq("is_read", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.inquiry_id] = (counts[row.inquiry_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-inquiries-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiry_comments" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-inquiries-unread-counts"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const columns = showHidden ? ALL_STATUSES : STATUS_COLUMNS;
  const serviceOptions = Array.from(new Set(items.flatMap((i) => inquiryServices(i)))).sort();
  const channelOptions = Array.from(new Set(items.map((i) => i.channel).filter((c): c is string => Boolean(c)))).sort();
  const searchLower = search.trim().toLowerCase();
  const filteredItems = items
    .filter((i) => {
      const iServices = inquiryServices(i);
      if (serviceFilter && !iServices.includes(serviceFilter)) return false;
      if (channelFilter && i.channel !== channelFilter) return false;
      if (!searchLower) return true;
      return [i.name, i.contact, i.email, i.phone, ...iServices, i.message, i.inquiry_code]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(searchLower));
    })
    .sort(INQUIRY_SORT_OPTIONS[sortKey].cmp);
  const newCount = filteredItems.filter((i) => i.status === "New").length;
  const emailFailedCount = filteredItems.filter((i) => !i.email_sent).length;
  const openInquiry = openInquiryId ? (items.find((i) => i.id === openInquiryId) ?? null) : null;

  async function moveInquiry(id: string, status: Status) {
    const current = items.find((i) => i.id === id);
    if (!current || current.status === status) return;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      await doUpdateStatus({ data: { id, status } });
    } catch (err) {
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status: current.status } : i)));
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageCircle className="h-6 w-6 text-primary" /> Inquiries
          </h1>
          <p className="text-sm text-muted-foreground">
            {newCount} new · {filteredItems.length} of {items.length} shown · click{" "}
            {view === "board" ? "a card" : "a row"} to view details
            {view === "board"
              ? ", or drag it to another column to change its status."
              : ", or use the status dropdown to change its status directly."}
            {emailFailedCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-medium text-destructive">
                <MailWarning className="h-3.5 w-3.5" />
                {emailFailedCount} notification email{emailFailedCount === 1 ? "" : "s"} failed
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex shrink-0 rounded-md border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              aria-pressed={view === "board"}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ${
                view === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ${
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <List className="h-4 w-4" /> List
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add inquiry
          </button>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm ${
              showHidden ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {showHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showHidden ? "Hide" : "Show"} rejected / cancelled
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, contact, service, message, code…"
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
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="">All platforms</option>
          {channelOptions.map((c) => (
            <option key={c} value={c}>
              {platformLabel(c).label}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as InquirySortKey)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          {Object.entries(INQUIRY_SORT_OPTIONS).map(([key, opt]) => (
            <option key={key} value={key}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        {(search || serviceFilter || channelFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setServiceFilter("");
              setChannelFilter("");
            }}
            className="rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No inquiries yet. Visitors who use the chat widget will show up here in real time.
        </div>
      )}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No inquiries match your search or filter.
        </div>
      )}

      {!loading && filteredItems.length > 0 && view === "board" && (
        <div className="flex h-[calc(100vh-260px)] snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {columns.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              items={filteredItems.filter((i) => i.status === status)}
              onOpen={(i) => setOpenInquiryId(i.id)}
              onDropInquiry={moveInquiry}
              unreadCounts={unreadCounts}
            />
          ))}
        </div>
      )}

      {!loading && filteredItems.length > 0 && view === "list" && (
        <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
          {filteredItems.map((i) => (
            <InquiryListRow
              key={i.id}
              inquiry={i}
              onOpen={() => setOpenInquiryId(i.id)}
              onStatusChange={(status) => moveInquiry(i.id, status)}
              statusOptions={columns}
              unreadCount={unreadCounts[i.id]}
            />
          ))}
        </div>
      )}

      {openInquiry && (
        <InquiryDetail
          inquiry={openInquiry}
          onClose={() => setOpenInquiryId(null)}
          onDeleted={(id) => {
            setItems((cur) => cur.filter((i) => i.id !== id));
            setOpenInquiryId(null);
          }}
        />
      )}

      {showCreate && (
        <NewInquiryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}
