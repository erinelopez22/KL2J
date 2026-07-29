import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/auth/google-business/callback")({
  server: {
    handlers: {
      GET: async () => {
        const request = getRequest();
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const redirectBase = `${url.origin}/admin/google-business`;

        if (errorParam) {
          return Response.redirect(`${redirectBase}?error=${encodeURIComponent(errorParam)}`, 302);
        }
        if (!code || !state) {
          return Response.redirect(`${redirectBase}?error=missing_code`, 302);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("google_business_connection")
          .select("pending_state, pending_state_created_at")
          .eq("id", 1)
          .single();

        const stateAge = row?.pending_state_created_at
          ? Date.now() - new Date(row.pending_state_created_at).getTime()
          : Infinity;
        if (!row?.pending_state || row.pending_state !== state || stateAge > 10 * 60 * 1000) {
          return Response.redirect(`${redirectBase}?error=invalid_state`, 302);
        }

        try {
          const { getOAuthClient } = await import("@/lib/admin/google-business.server");
          const redirectUri = `${url.origin}/api/auth/google-business/callback`;
          const client = getOAuthClient(redirectUri);
          const { tokens } = await client.getToken(code);

          if (!tokens.refresh_token) {
            return Response.redirect(`${redirectBase}?error=no_refresh_token`, 302);
          }

          await supabaseAdmin
            .from("google_business_connection")
            .update({
              access_token: tokens.access_token ?? null,
              refresh_token: tokens.refresh_token,
              token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
              scope: tokens.scope ?? null,
              pending_state: null,
              pending_state_created_at: null,
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          return Response.redirect(`${redirectBase}?connected=1`, 302);
        } catch (err) {
          console.error("Google Business OAuth callback failed", err);
          return Response.redirect(`${redirectBase}?error=exchange_failed`, 302);
        }
      },
    },
  },
});
