import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, RefreshCw, CheckCircle2, Clock, MailWarning } from "lucide-react";

type Inquiry = {
  id: string;
  created_at: string;
  name: string;
  contact: string;
  service: string | null;
  services: string[];
  message: string | null;
  channel: string | null;
  status: string;
  email_sent: boolean;
  email_error: string | null;
};

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "Inquiries Inbox — KL2J Land Surveying and Engineering Services" }],
  }),
  component: InboxPage,
});

function InboxPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as Inquiry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("inquiries-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function setStatus(id: string, status: string) {
    await supabase.from("inquiries").update({ status }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  const newCount = items.filter((i) => i.status === "New").length;
  const emailFailedCount = items.filter((i) => !i.email_sent).length;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MessageCircle className="h-6 w-6 text-primary" /> Inquiries Inbox
            </h1>
            <p className="text-sm text-muted-foreground">
              {newCount} new · {items.length} total
              {emailFailedCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 font-medium text-destructive">
                  <MailWarning className="h-3.5 w-3.5" />
                  {emailFailedCount} notification email{emailFailedCount === 1 ? "" : "s"} failed
                </span>
              )}
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            No inquiries yet. Visitors who use the chat widget will show up here in real time.
          </div>
        )}

        <div className="space-y-3">
          {items.map((i) => (
            <div
              key={i.id}
              className={`rounded-lg border p-4 shadow-sm ${
                i.status === "New" ? "border-primary/40 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{i.name}</span>
                    <span className="text-xs text-muted-foreground">· {i.contact}</span>
                    {i.channel && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {i.channel}
                      </span>
                    )}
                    {!i.email_sent && (
                      <span
                        title={i.email_error ?? "Notification email failed to send"}
                        className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive"
                      >
                        <MailWarning className="h-3 w-3" /> Email not sent
                      </span>
                    )}
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        i.status === "New"
                          ? "bg-primary text-primary-foreground"
                          : i.status === "Completed"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i.status}
                    </span>
                  </div>
                  {(i.services?.length > 0 || i.service) && (
                    <div className="mt-1 text-sm font-medium text-primary">
                      {i.services?.length > 0 ? i.services.join(", ") : i.service}
                    </div>
                  )}
                  {i.message && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{i.message}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(i.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {i.status !== "Completed" && (
                  <button
                    onClick={() => setStatus(i.id, "Completed")}
                    className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Mark resolved
                  </button>
                )}
                {i.status === "Completed" && (
                  <button
                    onClick={() => setStatus(i.id, "New")}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    Reopen
                  </button>
                )}
                {/^\+?\d[\d\s\-]{6,}$/.test(i.contact) && (
                  <a
                    href={`tel:${i.contact.replace(/\s/g, "")}`}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    Call
                  </a>
                )}
                {i.contact.includes("@") && (
                  <a
                    href={`mailto:${i.contact}`}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    Email
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
