import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function callbackRedirectUri(): string {
  const request = getRequest();
  const origin = new URL(request.url).origin;
  return `${origin}/api/auth/google-business/callback`;
}

export const getGoogleBusinessStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("google_business_connection")
      .select("account_name, location_name, location_title, connected_at")
      .eq("id", 1)
      .single();
    if (error) {
      console.error("getGoogleBusinessStatus failed", error);
      throw new Error("Failed to load connection status");
    }

    return {
      connected: Boolean(data?.connected_at),
      accountName: data?.account_name ?? null,
      locationName: data?.location_name ?? null,
      locationTitle: data?.location_title ?? null,
      connectedAt: data?.connected_at ?? null,
    };
  });

export const startGoogleBusinessConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { getOAuthClient, GOOGLE_BUSINESS_SCOPE } = await import("@/lib/admin/google-business.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const state = crypto.randomUUID();
    const { error } = await supabaseAdmin
      .from("google_business_connection")
      .update({ pending_state: state, pending_state_created_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      console.error("startGoogleBusinessConnect failed", error);
      throw new Error("Failed to start connection");
    }

    const client = getOAuthClient(callbackRedirectUri());
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [GOOGLE_BUSINESS_SCOPE],
      state,
    });

    return { url };
  });

export const disconnectGoogleBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "super_admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_business_connection")
      .update({
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        scope: null,
        account_name: null,
        location_name: null,
        location_title: null,
        connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) {
      console.error("disconnectGoogleBusiness failed", error);
      throw new Error("Failed to disconnect");
    }
    return { ok: true };
  });

export const listGoogleBusinessLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { getValidAccessToken, listAccounts, listLocations } = await import(
      "@/lib/admin/google-business.server"
    );
    const { accessToken } = await getValidAccessToken();
    const accounts = await listAccounts(accessToken);

    const results: Array<{ accountName: string; locationName: string; title: string }> = [];
    for (const account of accounts) {
      const locations = await listLocations(accessToken, account.name);
      for (const loc of locations) {
        results.push({ accountName: account.name, locationName: loc.name, title: loc.title ?? loc.name });
      }
    }
    return results;
  });

const SelectLocationSchema = z.object({
  accountName: z.string().min(1),
  locationName: z.string().min(1),
  locationTitle: z.string().min(1),
});

export const selectGoogleBusinessLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SelectLocationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_business_connection")
      .update({
        account_name: data.accountName,
        location_name: data.locationName,
        location_title: data.locationTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) {
      console.error("selectGoogleBusinessLocation failed", error);
      throw new Error("Failed to select location");
    }
    return { ok: true };
  });

export const getGoogleBusinessInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { getValidAccessToken, getLocationDetails } = await import("@/lib/admin/google-business.server");
    const { accessToken, locationName } = await getValidAccessToken();
    if (!locationName) throw new Error("No location selected yet");
    return getLocationDetails(accessToken, locationName);
  });

export const getGoogleBusinessInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { getValidAccessToken, getPerformanceMetrics } = await import("@/lib/admin/google-business.server");
    const { accessToken, locationName } = await getValidAccessToken();
    if (!locationName) throw new Error("No location selected yet");
    return getPerformanceMetrics(accessToken, locationName);
  });

export const getGoogleBusinessReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { getValidAccessToken, getReviews } = await import("@/lib/admin/google-business.server");
    const { accessToken, locationName } = await getValidAccessToken();
    if (!locationName) throw new Error("No location selected yet");
    return getReviews(accessToken, locationName);
  });
