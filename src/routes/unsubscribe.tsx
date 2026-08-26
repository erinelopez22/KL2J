import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { confirmUnsubscribe } from "@/lib/public-unsubscribe.functions";
import bgUrl from "@/assets/kl2j-bg.png";
import logoUrl from "@/assets/kl2j-logo.jpg";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe — KL2J Land Surveying and Engineering Services" },
      { name: "description", content: "Unsubscribe from KL2J announcement emails." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { email?: string; token?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { email, token } = Route.useSearch();
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const doConfirm = useServerFn(confirmUnsubscribe);

  async function handleConfirm() {
    if (!email || !token) return;
    setStatus("busy");
    try {
      await doConfirm({ data: { email, token } });
      setStatus("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center bg-cover bg-right"
      style={{ backgroundImage: `url(${bgUrl})` }}
    >
      <div className="absolute inset-0 bg-slate-950/70" />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card px-8 py-12 shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <img src={logoUrl} alt="KL2J logo" className="h-9 w-9 rounded-full object-cover ring-1 ring-border" />
          <span className="text-lg font-bold tracking-tight">KL2J Land Surveying and Engineering Services</span>
        </div>

        {!email || !token ? (
          <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or incomplete.</p>
        ) : status === "done" ? (
          <>
            <h1 className="text-xl font-semibold text-emerald-700">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{email}</span> will no longer receive announcement
              emails from KL2J.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Unsubscribe from KL2J emails?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This stops future announcement emails to{" "}
              <span className="font-medium text-foreground">{email}</span>. You can still reach us anytime
              through the website.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={status === "busy"}
              className="mt-6 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {status === "busy" ? "Please wait…" : "Confirm unsubscribe"}
            </button>
            {status === "error" && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}
          </>
        )}
      </div>
    </div>
  );
}
