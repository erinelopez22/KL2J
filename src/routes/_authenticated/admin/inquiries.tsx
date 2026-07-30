import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectFormModal, type ProjectStatus } from "@/components/admin/ProjectFormModal";
import { MessageCircle, RefreshCw, Clock, MailWarning, Eye, EyeOff, X, FolderKanban, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/inquiries")({
  component: AdminInquiries,
});

const STATUS_COLUMNS = ["New", "Attended", "Completed"] as const;
const HIDDEN_COLUMNS = ["Cancelled", "Rejected"] as const;
type Status = (typeof STATUS_COLUMNS)[number] | (typeof HIDDEN_COLUMNS)[number];
const ALL_STATUSES = [...STATUS_COLUMNS, ...HIDDEN_COLUMNS];

const STATUS_HEADER_STYLES: Record<Status, string> = {
  New: "border-t-blue-500",
  Attended: "border-t-indigo-500",
  Completed: "border-t-emerald-500",
  Cancelled: "border-t-muted-foreground",
  Rejected: "border-t-destructive",
};

const STATUS_BADGE_STYLES: Record<Status, string> = {
  New: "bg-blue-100 text-blue-700",
  Attended: "bg-indigo-100 text-indigo-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-muted text-muted-foreground",
  Rejected: "bg-destructive/10 text-destructive",
};

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  Created: "bg-muted text-muted-foreground",
  Attended: "bg-blue-100 text-blue-700",
  "On-hold": "bg-amber-100 text-amber-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-destructive/10 text-destructive",
};

type Inquiry = {
  id: string;
  created_at: string;
  name: string;
  contact: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  message: string | null;
  channel: string | null;
  status: Status;
  email_sent: boolean;
  email_error: string | null;
};

type LinkedProject = { id: string; title: string; status: ProjectStatus };

function InquiryCard({ inquiry, onOpen }: { inquiry: Inquiry; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm hover:border-primary/40"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold">{inquiry.name}</span>
        {inquiry.channel && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            {inquiry.channel}
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
      {inquiry.service && <div className="mt-1 text-xs font-medium text-primary">{inquiry.service}</div>}
      {inquiry.message && <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{inquiry.message}</p>}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {new Date(inquiry.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

function StatusColumn({ status, items, onOpen }: { status: Status; items: Inquiry[]; onOpen: (i: Inquiry) => void }) {
  return (
    <div className={`flex w-[260px] shrink-0 flex-col rounded-lg border-t-4 bg-muted/30 ${STATUS_HEADER_STYLES[status]}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold">{status}</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ minHeight: 80 }}>
        {items.map((i) => (
          <InquiryCard key={i.id} inquiry={i} onOpen={() => onOpen(i)} />
        ))}
      </div>
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
        .select("id, title, status")
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
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${PROJECT_STATUS_STYLES[linkedProject.status]}`}
          >
            {linkedProject.status}
          </span>
        </div>
        <Link to="/admin/projects" className="shrink-0 text-primary hover:underline">
          Manage →
        </Link>
      </div>
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
          defaultInquiry={{ id: inquiry.id, label: `${inquiry.name} · ${inquiry.contact}` }}
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

function InquiryDetail({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
  // Newer inquiries have dedicated email/phone columns. Older rows only have
  // "contact" (email or phone, whichever the customer entered) with the
  // phone sometimes embedded as a "Phone: ..." prefix in the message.
  const hasDedicatedFields = Boolean(inquiry.email || inquiry.phone);
  const legacy = parseInquiryMessage(inquiry.message);
  const contactIsEmail = inquiry.contact.includes("@");
  const email = inquiry.email || (!hasDedicatedFields && contactIsEmail ? inquiry.contact : null);
  const phone = inquiry.phone || legacy.phone || (!hasDedicatedFields && !contactIsEmail ? inquiry.contact : null);
  const details = hasDedicatedFields ? inquiry.message : legacy.details;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[inquiry.status]}`}
          >
            {inquiry.status}
          </span>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {inquiry.service && (
          <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2.5">
            <span className="text-sm font-bold text-primary">Service Type : {inquiry.service}</span>
          </div>
        )}

        <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
          <div className="flex items-center justify-between gap-4 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Customer Name</span>
            <span className="text-right font-semibold">{inquiry.name}</span>
          </div>
          {email && (
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <span className="text-right">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Number</span>
              <span className="text-right">{phone}</span>
            </div>
          )}
          {details && (
            <div className="px-3 py-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Inquiry details</span>
              <p className="whitespace-pre-wrap leading-relaxed">{details}</p>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/60">
          {inquiry.channel && <span>via {inquiry.channel}</span>}
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

        <div className="mt-3 border-t border-border pt-3">
          <LinkedProjectSection inquiry={inquiry} />
        </div>
      </div>
    </div>
  );
}

function AdminInquiries() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [openInquiryId, setOpenInquiryId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setItems((data as Inquiry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-inquiries-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const columns = showHidden ? ALL_STATUSES : STATUS_COLUMNS;
  const newCount = items.filter((i) => i.status === "New").length;
  const emailFailedCount = items.filter((i) => !i.email_sent).length;
  const openInquiry = openInquiryId ? (items.find((i) => i.id === openInquiryId) ?? null) : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageCircle className="h-6 w-6 text-primary" /> Inquiries
          </h1>
          <p className="text-sm text-muted-foreground">
            {newCount} new · {items.length} total · click a card to view details. Status moves automatically as its
            linked project progresses.
            {emailFailedCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-medium text-destructive">
                <MailWarning className="h-3.5 w-3.5" />
                {emailFailedCount} notification email{emailFailedCount === 1 ? "" : "s"} failed
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              showHidden ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {showHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showHidden ? "Hide" : "Show"} cancelled / rejected
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No inquiries yet. Visitors who use the chat widget will show up here in real time.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              items={items.filter((i) => i.status === status)}
              onOpen={(i) => setOpenInquiryId(i.id)}
            />
          ))}
        </div>
      )}

      {openInquiry && <InquiryDetail inquiry={openInquiry} onClose={() => setOpenInquiryId(null)} />}
    </div>
  );
}
