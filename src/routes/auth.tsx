import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KanbanSquare } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — KL2J" },
      { name: "description", content: "Sign in or create an account to use KL2J boards." },
      { property: "og:title", content: "Sign in — KL2J" },
      { property: "og:description", content: "Sign in or create an account to use KL2J boards." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/boards" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || email },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      }
      navigate({ to: "/boards" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 bg-gradient-to-br from-[#0C66E4] via-[#6B46C1] to-[#D53F8C]">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="rounded-lg bg-primary text-primary-foreground p-1.5"><KanbanSquare className="h-5 w-5" /></div>
          <span className="text-lg font-bold tracking-tight">KL2J</span>
        </div>
        <h1 className="text-2xl font-semibold mb-1">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signin" ? "Sign in to continue to your boards." : "Get started with your first board."}
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              className="w-full h-10 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <input
            className="w-full h-10 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full h-10 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <div className="mt-4 text-sm text-center text-muted-foreground">
          {mode === "signin" ? (
            <>New here? <button className="text-primary font-medium hover:underline" onClick={() => setMode("signup")}>Create an account</button></>
          ) : (
            <>Already have one? <button className="text-primary font-medium hover:underline" onClick={() => setMode("signin")}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
