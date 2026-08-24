import { createFileRoute } from "@tanstack/react-router";

// Cloud Scheduler's HTTP target — NOT reachable from the browser/admin UI.
// Authenticated with a shared secret (the CRON_SECRET env var / Secret
// Manager entry) rather than a user session, since there's no logged-in
// admin driving this call. Processes exactly one due recipient per
// invocation; call cadence (recommended: every 1 minute) is what throttles
// sending, not anything in this handler.
export const Route = createFileRoute("/api/cron/process-email-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          console.error("process-email-queue: CRON_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }
        if (request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { processNextQueuedEmail } = await import(
            "@/lib/admin/email-queue-worker.server"
          );
          const result = await processNextQueuedEmail();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("process-email-queue failed", err);
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
