import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, FileText, Paperclip, RefreshCw, X } from "lucide-react";
import {
  lookupInquiryByCode,
  recoverInquiryCode,
  addInquiryComment,
  getInquiryCommentFileUrl,
} from "@/lib/public-inquiry-access.functions";
import { uploadInquiryDocument } from "@/lib/public-media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";
import logoUrl from "@/assets/kl2j-logo.jpg";

export const Route = createFileRoute("/my-inquiries")({
  head: () => ({
    meta: [
      { title: "My Inquiries — KL2J Land Surveying and Engineering Services" },
      { name: "description", content: "Check the status of your inquiry and message our team." },
    ],
  }),
  component: MyInquiriesPage,
});

type Attachment = { path: string; name: string; contentType: string };
type ChecklistResponseView = {
  id: string;
  label: string;
  type: "text" | "number" | "location" | "checkbox" | "document";
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: Attachment[];
};
type CommentView = {
  id: string;
  author_type: "admin" | "inquirer";
  author_name: string | null;
  message: string | null;
  attachments: Attachment[];
  created_at: string;
};
type InquiryView = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  message: string | null;
  status: string;
  created_at: string;
  checklist_responses: ChecklistResponseView[];
  comments: CommentView[];
  attachments: Attachment[];
};

function ForgotCodeForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"sent" | "notfound" | null>(null);
  const doRecover = useServerFn(recoverInquiryCode);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await doRecover({ data: { email: email.trim(), name: name.trim() } });
      setResult(res.matched ? "sent" : "notfound");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Registered email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Your name (first, last, or full)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Resend my code"}
      </button>
      {result === "sent" && (
        <p className="text-sm font-medium text-emerald-700">Your inquiry code has been sent to your email.</p>
      )}
      {result === "notfound" && (
        <p className="text-sm font-medium text-destructive">That name and email didn't match any inquiry.</p>
      )}
    </form>
  );
}

function CommentsThread({
  inquiry,
  code,
  onUpdate,
  onOpenFile,
}: {
  inquiry: InquiryView;
  code: string;
  onUpdate: (i: InquiryView) => void;
  onOpenFile: (path: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const doAddComment = useServerFn(addInquiryComment);
  const doUpload = useServerFn(uploadInquiryDocument);
  const doLookup = useServerFn(lookupInquiryByCode);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await doUpload({ data: { filename: file.name, contentType: file.type, base64 } });
      setAttachments((a) => [...a, { path: result.path, name: file.name, contentType: result.contentType }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function send() {
    if (!message.trim() && attachments.length === 0) {
      toast.error("Write a message or attach a file");
      return;
    }
    setBusy(true);
    try {
      await doAddComment({ data: { code, message: message.trim() || undefined, attachments } });
      setMessage("");
      setAttachments([]);
      const refreshed = await doLookup({ data: { code } });
      onUpdate(refreshed as unknown as InquiryView);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="max-h-[40vh] min-h-[100px] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
        {inquiry.comments.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {inquiry.comments.map((c) => (
          <div key={c.id} className={`flex ${c.author_type === "inquirer" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                c.author_type === "inquirer" ? "bg-primary text-primary-foreground" : "border border-border bg-card"
              }`}
            >
              <div
                className={`mb-0.5 text-[10px] font-medium uppercase ${
                  c.author_type === "inquirer" ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {c.author_type === "inquirer" ? "You" : "KL2J Team"} · {new Date(c.created_at).toLocaleString()}
              </div>
              {c.message && <p className="whitespace-pre-wrap leading-relaxed">{c.message}</p>}
              {c.attachments?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.attachments.map((a) => (
                    <button
                      key={a.path}
                      type="button"
                      onClick={() => onOpenFile(a.path)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                        c.author_type === "inquirer"
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
      <textarea
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write a message to our team…"
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span key={a.path} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {a.name}
              <button
                type="button"
                onClick={() => setAttachments((cur) => cur.filter((x) => x.path !== a.path))}
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !uploading && inputRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          <Paperclip className="h-4 w-4" /> {uploading ? "Uploading…" : "Attach"}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

function InquiryPanel({
  inquiry,
  code,
  onUpdate,
  onClose,
}: {
  inquiry: InquiryView;
  code: string;
  onUpdate: (i: InquiryView) => void;
  onClose: () => void;
}) {
  const doGetUrl = useServerFn(getInquiryCommentFileUrl);
  const doLookup = useServerFn(lookupInquiryByCode);
  const [refreshing, setRefreshing] = useState(false);

  async function openFile(path: string) {
    try {
      const { url } = await doGetUrl({ data: { code, path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open file");
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const refreshed = await doLookup({ data: { code } });
      onUpdate(refreshed as unknown as InquiryView);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{inquiry.name}</h2>
          <p className="text-sm text-muted-foreground">{inquiry.service || "General inquiry"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase">{inquiry.status}</span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Look up another
          </button>
        </div>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
        <div className="grid grid-cols-[35%_1fr] gap-3 px-3 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Submitted</span>
          <span>{new Date(inquiry.created_at).toLocaleString()}</span>
        </div>
        {inquiry.email && (
          <div className="grid grid-cols-[35%_1fr] gap-3 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <span>{inquiry.email}</span>
          </div>
        )}
        {inquiry.phone && (
          <div className="grid grid-cols-[35%_1fr] gap-3 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Phone</span>
            <span>{inquiry.phone}</span>
          </div>
        )}
        {inquiry.message && (
          <div className="px-3 py-2.5">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Message</span>
            <p className="whitespace-pre-wrap leading-relaxed">{inquiry.message}</p>
          </div>
        )}
      </div>

      {inquiry.checklist_responses.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
          <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
            Details you provided
          </div>
          {inquiry.checklist_responses.map((c) => (
            <div key={c.id} className="grid grid-cols-[35%_1fr] items-start gap-3 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              {c.type === "checkbox" ? (
                <span className="inline-flex items-center gap-1.5">
                  {c.checked ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                  {c.checked ? "Yes" : "No"}
                </span>
              ) : c.type === "document" ? (
                c.documents && c.documents.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {c.documents.map((d) => (
                      <button
                        key={d.path}
                        type="button"
                        onClick={() => openFile(d.path)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
                      >
                        <FileText className="h-3.5 w-3.5" /> {d.name}
                      </button>
                    ))}
                  </div>
                ) : c.hasDocument ? (
                  <span className="font-medium text-emerald-700">Yes (not uploaded)</span>
                ) : (
                  <span className="text-muted-foreground/60">No</span>
                )
              ) : (
                <span>{c.answer?.trim() || "—"}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {inquiry.attachments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">All files</h3>
          <div className="flex flex-wrap gap-1.5">
            {inquiry.attachments.map((a) => (
              <button
                key={a.path}
                type="button"
                onClick={() => openFile(a.path)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5" /> {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Messages</h3>
        <CommentsThread inquiry={inquiry} code={code} onUpdate={onUpdate} onOpenFile={openFile} />
      </div>
    </div>
  );
}

function MyInquiriesPage() {
  const [code, setCode] = useState("");
  const [inquiry, setInquiry] = useState<InquiryView | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const doLookup = useServerFn(lookupInquiryByCode);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const result = await doLookup({ data: { code: code.trim() } });
      setInquiry(result as unknown as InquiryView);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to look up inquiry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 font-bold">
            <img src={logoUrl} alt="KL2J" className="h-9 w-9 rounded-full object-cover ring-1 ring-border" />
            <span className="text-base tracking-tight">KL2J</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">My Inquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the inquiry code you received by email (or right after submitting) to view your inquiry and message
          our team.
        </p>

        {!inquiry ? (
          <div className="mt-6 max-w-md">
            <form onSubmit={submitCode} className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. KL-7F3QX9"
                className="h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm uppercase tracking-wide"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-11 shrink-0 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Checking…" : "View"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Forgot your code?
            </button>
            {showForgot && <ForgotCodeForm />}
          </div>
        ) : (
          <InquiryPanel inquiry={inquiry} code={code.trim()} onUpdate={setInquiry} onClose={() => setInquiry(null)} />
        )}
      </main>
    </div>
  );
}
