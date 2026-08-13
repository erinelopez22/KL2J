import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import bgUrl from "@/assets/kl2j-bg.png";
import logoUrl from "@/assets/kl2j-logo.jpg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — KL2J Land Surveying and Engineering Services" },
      { name: "description", content: "Sign in to access the admin dashboard." },
      { property: "og:title", content: "Sign in — KL2J Land Surveying and Engineering Services" },
      { property: "og:description", content: "Sign in to access the admin dashboard." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/admin/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center bg-cover bg-right"
      style={{ backgroundImage: `url(${bgUrl})` }}
    >
      <div className="absolute inset-0 bg-slate-950/70" />
      <div className="relative w-full max-w-lg lg:-translate-x-50 xl:-translate-x-66 rounded-2xl border border-border bg-card shadow-2xl px-8 py-14">
        <div className="flex items-center gap-2 mb-8">
          <img src={logoUrl} alt="KL2J logo" className="h-9 w-9 rounded-full object-cover ring-1 ring-border" />
          <span className="text-lg font-bold tracking-tight">KL2J Land Surveying and Engineering Services</span>
        </div>
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Sign in to access the admin dashboard.
        </p>
        <form onSubmit={onSubmit} className="space-y-5">
          <input
            className="w-full h-12 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full h-12 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
