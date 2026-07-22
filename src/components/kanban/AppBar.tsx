import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, KanbanSquare, LogOut, Search } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useQueryClient } from "@tanstack/react-query";

export function AppBar({ transparent = false }: { transparent?: boolean }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);

  const initial = (user?.user_metadata?.full_name || user?.email || "?").charAt(0).toUpperCase();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header
      className={`h-12 flex items-center gap-3 px-4 z-30 ${
        transparent ? "bg-black/20 text-white backdrop-blur" : "bg-card border-b border-border"
      }`}
    >
      <Link to="/boards" className="flex items-center gap-2 font-bold">
        <KanbanSquare className="h-5 w-5" />
        <span className="hidden sm:inline">KL2J</span>
      </Link>
      <Link
        to="/boards"
        className={`text-sm px-2 py-1 rounded ${transparent ? "hover:bg-white/10" : "hover:bg-accent"}`}
      >
        Boards
      </Link>
      <div className="flex-1 max-w-sm relative hidden md:block">
        <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-60" />
        <input
          className={`w-full h-8 pl-8 pr-3 rounded text-sm outline-none ${
            transparent
              ? "bg-white/15 placeholder-white/70 text-white focus:bg-white/25"
              : "bg-secondary focus:bg-background border border-transparent focus:border-input"
          }`}
          placeholder="Search"
        />
      </div>
      <div className="flex-1 md:hidden" />
      <button className={`p-2 rounded ${transparent ? "hover:bg-white/10" : "hover:bg-accent"}`}>
        <Bell className="h-4 w-4" />
      </button>
      <div className="relative">
        <button
          onClick={() => setMenu((v) => !v)}
          className="h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center"
        >
          {initial}
        </button>
        {menu && (
          <div className="absolute right-0 top-10 w-56 rounded-lg bg-popover text-popover-foreground shadow-xl border border-border py-1">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border truncate">{user?.email}</div>
            <button
              onClick={signOut}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
