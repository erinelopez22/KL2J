import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ReviewSchema = z.object({
  name: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().max(2000).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
});

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ReviewSchema.parse(data))
  .handler(async ({ data }) => {
    const { insertReviewAndNotify } = await import("@/lib/reviews-notify.server");
    return insertReviewAndNotify(data);
  });
