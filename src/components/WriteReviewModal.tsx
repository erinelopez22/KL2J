import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, X, BadgeCheck } from "lucide-react";
import { submitReview } from "@/lib/reviews.functions";

export function WriteReviewModal({
  onClose,
  defaultName = "",
}: {
  onClose: () => void;
  defaultName?: string;
}) {
  const doSubmit = useServerFn(submitReview);
  const [name, setName] = useState(defaultName);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }
    setSubmitting(true);
    try {
      await doSubmit({
        data: { name, rating, review_text: reviewText.trim() || undefined, email: email.trim() || undefined },
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="py-4 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-3 text-lg font-semibold">Thanks for your review!</h3>
            <p className="mt-1 text-sm text-muted-foreground">It'll appear on the site once our team reviews it.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">Write a review</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">
                  Your rating
                </label>
                <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${
                          n <= (hoverRating || rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                  className="h-11 w-full rounded-md border border-border px-3 text-sm"
                  placeholder="Juan dela Cruz"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">
                  Email <span className="normal-case text-muted-foreground/70">(optional, kept private)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={200}
                  className="h-11 w-full rounded-md border border-border px-3 text-sm"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">
                  Your review <span className="normal-case text-muted-foreground/70">(optional)</span>
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm"
                  placeholder="Tell us about your experience working with KL2J."
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
