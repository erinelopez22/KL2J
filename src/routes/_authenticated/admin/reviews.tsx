import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, Check, X, Trash2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateReviewStatus, deleteReview } from "@/lib/admin/reviews.functions";
import { useConfirm } from "@/components/ConfirmDialogProvider";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: AdminReviews,
});

type Review = {
  id: string;
  name: string;
  rating: number;
  review_text: string | null;
  email: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const STATUS_STYLES: Record<Review["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-muted text-muted-foreground",
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function AdminReviews() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const doUpdateStatus = useServerFn(updateReviewStatus);
  const doDelete = useServerFn(deleteReview);
  const [filter, setFilter] = useState<"all" | Review["status"]>("all");

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
  }

  async function setStatus(id: string, status: Review["status"]) {
    try {
      await doUpdateStatus({ data: { id, status } });
      toast.success(`Review ${status}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update review");
    }
  }

  async function remove(review: Review) {
    if (!(await confirm("Delete this review? This cannot be undone.", { destructive: true }))) return;
    try {
      await doDelete({ data: { id: review.id } });
      toast.success("Review deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const all = reviews ?? [];
  const counts = {
    all: all.length,
    pending: all.filter((r) => r.status === "pending").length,
    approved: all.filter((r) => r.status === "approved").length,
    rejected: all.filter((r) => r.status === "rejected").length,
  };
  const filtered = filter === "all" ? all : all.filter((r) => r.status === filter);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Star className="h-6 w-6 text-primary" /> Reviews
      </h1>
      <p className="text-sm text-muted-foreground">
        Customer reviews submitted on the public site. Approve one to show it publicly, or reject/delete it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
              filter === f ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No {filter === "all" ? "" : filter} reviews.
        </div>
      )}

      <div className="mt-6 space-y-2">
        {filtered.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[r.status]}`}>
                  {r.status}
                </span>
                {r.email && (
                  <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" /> <span className="min-w-0 break-all">{r.email}</span>
                  </span>
                )}
              </div>
              <div className="mt-1">
                <StarRow rating={r.rating} />
              </div>
              {r.review_text && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{r.review_text}</p>}
              <div className="mt-1.5 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {r.status !== "approved" && (
                <button
                  onClick={() => setStatus(r.id, "approved")}
                  className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
              )}
              {r.status !== "rejected" && (
                <button
                  onClick={() => setStatus(r.id, "rejected")}
                  className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              )}
              <button
                onClick={() => remove(r)}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
