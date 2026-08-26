import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UnsubscribeSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

export const confirmUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UnsubscribeSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUnsubscribeToken } = await import("@/lib/unsubscribe-token.server");
    if (!verifyUnsubscribeToken(data.email, data.token)) {
      throw new Error("This unsubscribe link is invalid.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_suppressions")
      .upsert({ email: data.email.trim().toLowerCase() }, { onConflict: "email" });
    if (error) {
      console.error("confirmUnsubscribe failed", error);
      throw new Error("Something went wrong. Please try again.");
    }

    return { ok: true };
  });
