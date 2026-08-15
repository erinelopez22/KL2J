import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, Check, X, Trash2, Mail, Loader2 } from "lucide-react";
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
        <Star
          key={n}
          className={`h-4 w-4 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ReviewViewer({
  review,
  onClose,
  onChanged,
  onDeleted,
}: {
  review: Review;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const doUpdateStatus = useServerFn(updateReviewStatus);
  const doDelete = useServerFn(deleteReview);
  const [updating, setUpdating] = useState(false);

  async function setStatus(status: Review["status"]) {
    setUpdating(true);
    try {
      await doUpdateStatus({ data: { id: review.id, status } });
      toast.success(`Review ${status}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update review");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!(await confirm("Delete this review? This cannot be undone.", { destructive: true })))
      return;
    try {
      await doDelete({ data: { id: review.id } });
      toast.success("Review deleted");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{review.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[review.status]}`}
              >
                {review.status}
              </span>
            </div>
            {review.email && (
              <span className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />{" "}
                <span className="min-w-0 break-all">{review.email}</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3">
          <StarRow rating={review.rating} />
        </div>
        {review.review_text && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {review.review_text}
          </p>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {new Date(review.created_at).toLocaleString()}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {review.status !== "approved" && (
            <button
              onClick={() => setStatus("approved")}
              disabled={updating}
              className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {updating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}{" "}
              Approve
            </button>
          )}
          {review.status !== "rejected" && (
            <button
              onClick={() => setStatus("rejected")}
              disabled={updating}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {updating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}{" "}
              Reject
            </button>
          )}
          <button
            onClick={handleDelete}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminReviews() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const doDelete = useServerFn(deleteReview);
  const [filter, setFilter] = useState<"all" | Review["status"]>("all");
  const [viewing, setViewing] = useState<Review | null>(null);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
  }

  async function remove(review: Review) {
    if (!(await confirm("Delete this review? This cannot be undone.", { destructive: true })))
      return;
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
        Customer reviews submitted on the public site. Click one to approve it for public display,
        or reject/delete it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
              filter === f
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
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
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => setViewing(r)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setViewing(r);
            }}
            className="flex cursor-pointer flex-wrap items-start gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[r.status]}`}
                >
                  {r.status}
                </span>
                {r.email && (
                  <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />{" "}
                    <span className="min-w-0 break-all">{r.email}</span>
                  </span>
                )}
              </div>
              <div className="mt-1">
                <StarRow rating={r.rating} />
              </div>
              {r.review_text && (
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                  {r.review_text}
                </p>
              )}
              <div className="mt-1.5 text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(r);
              }}
              className="shrink-0 flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        ))}
      </div>

      {viewing && (
        <ReviewViewer
          review={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => {
            refresh();
            setViewing(null);
          }}
          onDeleted={() => {
            setViewing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
