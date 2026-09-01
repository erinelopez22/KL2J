import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle,
  Image as ImageIcon,
  FileText,
  Wrench,
  FolderKanban,
  Star,
  Megaphone,
  Cog,
  Handshake,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
});

function useCount(
  table:
    | "inquiries"
    | "services"
    | "gallery_photos"
    | "documents"
    | "projects"
    | "posts"
    | "equipment"
    | "partner_companies",
) {
  return useQuery({
    queryKey: ["admin-count", table],
    queryFn: async () => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function StatCard({
  to,
  label,
  count,
  icon: Icon,
}: {
  to: string;
  label: string;
  count: number | undefined;
  icon: typeof MessageCircle;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="rounded-lg bg-primary/10 p-3 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold">{count ?? "—"}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}

function usePendingReviewCount() {
  return useQuery({
    queryKey: ["admin-count", "reviews", "pending"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function AdminDashboard() {
  const inquiries = useCount("inquiries");
  const services = useCount("services");
  const gallery = useCount("gallery_photos");
  const documents = useCount("documents");
  const projects = useCount("projects");
  const posts = useCount("posts");
  const equipment = useCount("equipment");
  const companies = useCount("partner_companies");
  const pendingReviews = usePendingReviewCount();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your site's content and inquiries.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          to="/admin/inquiries"
          label="Inquiries"
          count={inquiries.data}
          icon={MessageCircle}
        />
        <StatCard
          to="/admin/reviews"
          label="Pending reviews"
          count={pendingReviews.data}
          icon={Star}
        />
        <StatCard to="/admin/services" label="Services" count={services.data} icon={Wrench} />
        <StatCard to="/admin/equipment" label="Equipment" count={equipment.data} icon={Cog} />
        <StatCard
          to="/admin/gallery"
          label="Gallery (Photos/Videos)"
          count={gallery.data}
          icon={ImageIcon}
        />
        <StatCard to="/admin/documents" label="Documents" count={documents.data} icon={FileText} />
        <StatCard to="/admin/projects" label="Projects" count={projects.data} icon={FolderKanban} />
        <StatCard to="/admin/posts" label="Posts" count={posts.data} icon={Megaphone} />
        <StatCard
          to="/admin/companies"
          label="Tied-up Companies"
          count={companies.data}
          icon={Handshake}
        />
      </div>
    </div>
  );
}
