// Server-only. Dynamically import this inside server function handlers or
// API routes — never top-level import from *.functions.ts or route files
// (see the warning in src/integrations/supabase/client.server.ts).
import { OAuth2Client } from "google-auth-library";

export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

const ACCOUNT_MGMT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const PERFORMANCE_BASE = "https://businessprofileperformance.googleapis.com/v1";

export function getOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_GBP_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GBP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_GBP_CLIENT_ID / GOOGLE_GBP_CLIENT_SECRET environment variables");
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export async function getValidAccessToken(): Promise<{ accessToken: string; locationName: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("google_business_connection")
    .select("access_token, refresh_token, token_expiry, location_name")
    .eq("id", 1)
    .single();
  if (error || !row?.refresh_token) {
    throw new Error("Google Business Profile is not connected yet");
  }

  const expiry = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  const isExpiring = !row.access_token || expiry - Date.now() < 60_000;
  if (!isExpiring) {
    return { accessToken: row.access_token!, locationName: row.location_name };
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: row.refresh_token });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error("Failed to refresh Google access token");

  await supabaseAdmin
    .from("google_business_connection")
    .update({
      access_token: credentials.access_token,
      token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return { accessToken: credentials.access_token, locationName: row.location_name };
}

async function googleFetch(accessToken: string, url: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.error?.message || res.statusText;
    throw new Error(`Google API error (${res.status}): ${message}`);
  }
  return body;
}

export type GoogleAccount = { name: string; accountName?: string; type?: string };
export type GoogleLocation = { name: string; title?: string };

export async function listAccounts(accessToken: string): Promise<GoogleAccount[]> {
  const data = await googleFetch(accessToken, `${ACCOUNT_MGMT_BASE}/accounts`);
  return data.accounts ?? [];
}

export async function listLocations(accessToken: string, accountName: string): Promise<GoogleLocation[]> {
  const readMask = "name,title,phoneNumbers,storefrontAddress,websiteUri";
  const data = await googleFetch(
    accessToken,
    `${BUSINESS_INFO_BASE}/${accountName}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=100`,
  );
  return data.locations ?? [];
}

export async function getLocationDetails(accessToken: string, locationName: string): Promise<any> {
  const readMask = "name,title,phoneNumbers,storefrontAddress,websiteUri,regularHours,profile,categories";
  return googleFetch(accessToken, `${BUSINESS_INFO_BASE}/${locationName}?readMask=${encodeURIComponent(readMask)}`);
}

const PERFORMANCE_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_DIRECTION_REQUESTS",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
] as const;

export type PerformanceSeries = {
  dailyMetric: string;
  timeSeries?: { datedValues?: Array<{ date: { year: number; month: number; day: number }; value?: string }> };
};

export async function getPerformanceMetrics(accessToken: string, locationName: string): Promise<PerformanceSeries[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const dateParam = (d: Date, prefix: string) =>
    `${prefix}.year=${d.getFullYear()}&${prefix}.month=${d.getMonth() + 1}&${prefix}.day=${d.getDate()}`;

  const params = [
    ...PERFORMANCE_METRICS.map((m) => `dailyMetrics=${m}`),
    dateParam(start, "dailyRange.startDate"),
    dateParam(end, "dailyRange.endDate"),
  ].join("&");

  const data = await googleFetch(
    accessToken,
    `${PERFORMANCE_BASE}/${locationName}:fetchMultiDailyMetricsTimeSeries?${params}`,
  );
  return data.multiDailyMetricTimeSeries ?? [];
}

// NOTE: Google does not expose a documented, generally-available reviews
// endpoint in the current Business Profile API family (the old v4 "My
// Business API" reviews resource was retired). This is a best-effort call —
// callers should treat failure here as "reviews unavailable via API" rather
// than a hard error, and link admins to business.google.com instead.
export async function getReviews(accessToken: string, locationName: string): Promise<any> {
  return googleFetch(accessToken, `${BUSINESS_INFO_BASE}/${locationName}/reviews`);
}
