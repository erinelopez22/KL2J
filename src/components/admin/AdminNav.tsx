import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  LayoutDashboard,
  MessageCircle,
  Image as ImageIcon,
  FileText,
  Wrench,
  FolderKanban,
  Users,
  LogOut,
  Building2,
  Handshake,
  Star,
  Megaphone,
  Monitor,
  Bell,
  Cog,
} from "lucide-react";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/preview", label: "Preview", icon: Monitor },
  { to: "/admin/inquiries", label: "Inquiries", icon: MessageCircle },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/posts", label: "Posts", icon: Megaphone },
  { to: "/admin/services", label: "Services", icon: Wrench },
  { to: "/admin/equipment", label: "Equipment", icon: Cog },
  { to: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/companies", label: "Tied-up Companies", icon: Handshake },
  { to: "/admin/google-business", label: "Google Business", icon: Building2 },
];

async function countRows(table: "inquiries" | "reviews" | "inquiry_comments", filters: [string, string | boolean][]) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [col, val] of filters) query = query.eq(col, val);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function useAdminNotifications() {
  const queryClient = useQueryClient();

  const newInquiries = useQuery({
    queryKey: ["admin-notif-inquiries"],
    queryFn: () => countRows("inquiries", [["status", "New"]]),
    staleTime: 15_000,
  });
  const pendingReviews = useQuery({
    queryKey: ["admin-notif-reviews"],
    queryFn: () => countRows("reviews", [["status", "pending"]]),
    staleTime: 15_000,
  });
  const unreadMessages = useQuery({
    queryKey: ["admin-notif-messages"],
    queryFn: () => countRows("inquiry_comments", [["author_type", "inquirer"], ["is_read", false]]),
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["admin-notif-inquiries"] });
          const name = (payload.new as { name?: string }).name;
          toast.info(`New inquiry${name ? ` from ${name}` : ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reviews" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["admin-notif-reviews"] });
          const name = (payload.new as { name?: string }).name;
          toast.info(`New review${name ? ` from ${name}` : ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiry_comments" },
        (payload) => {
          const row = payload.new as { author_type?: string };
          if (row.author_type !== "inquirer") return;
          queryClient.invalidateQueries({ queryKey: ["admin-notif-messages"] });
          toast.info("New message on an inquiry");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    newInquiries: newInquiries.data ?? 0,
    pendingReviews: pendingReviews.data ?? 0,
    unreadMessages: unreadMessages.data ?? 0,
  };
}

function NotificationBell() {
  const { newInquiries, pendingReviews, unreadMessages } = useAdminNotifications();
  const total = newInquiries + pendingReviews + unreadMessages;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-md border border-border bg-background p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="mb-1 px-1 text-xs font-semibold uppercase text-muted-foreground">
          Notifications
        </p>
        <Link
          to="/admin/inquiries"
          className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
        >
          <span>New inquiries</span>
          <span className="font-semibold">{newInquiries}</span>
        </Link>
        <Link
          to="/admin/reviews"
          className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
        >
          <span>Pending reviews</span>
          <span className="font-semibold">{pendingReviews}</span>
        </Link>
        <Link
          to="/admin/inquiries"
          className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
        >
          <span>Unread messages</span>
          <span className="font-semibold">{unreadMessages}</span>
        </Link>
        {total === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">You're all caught up.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 py-3 sm:px-6">
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
        <NotificationBell />
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
