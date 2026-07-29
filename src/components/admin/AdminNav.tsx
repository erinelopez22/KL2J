import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  MessageCircle,
  Image as ImageIcon,
  FileText,
  Wrench,
  FolderKanban,
  Users,
  Palette,
  LogOut,
  Building2,
} from "lucide-react";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/inquiries", label: "Inquiries", icon: MessageCircle },
  { to: "/admin/branding", label: "Branding", icon: Palette },
  { to: "/admin/services", label: "Services", icon: Wrench },
  { to: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/google-business", label: "Google Business", icon: Building2 },
];

export function AdminNav({ isAdmin, isSuperAdmin }: { isAdmin: boolean; isSuperAdmin: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="relative sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3 sm:px-6">
        <span className="mr-4 text-sm font-bold tracking-tight">KL2J Admin</span>
        <div className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.exact }}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
            >
              <l.icon className="h-4 w-4" /> {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin/users"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
            >
              <Users className="h-4 w-4" /> Users
            </Link>
          )}
        </div>
      </div>
      <div className="absolute right-4 top-3 flex items-center gap-2">
        <Link
          to="/"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
        >
          View site
        </Link>
        <button
          onClick={signOut}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </header>
  );
}
