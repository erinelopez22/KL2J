import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, ExternalLink, MapPin, Phone, Globe, Star, TrendingUp, Unplug } from "lucide-react";
import {
  getGoogleBusinessStatus,
  startGoogleBusinessConnect,
  disconnectGoogleBusiness,
  listGoogleBusinessLocations,
  selectGoogleBusinessLocation,
  getGoogleBusinessInfo,
  getGoogleBusinessInsights,
  getGoogleBusinessReviews,
} from "@/lib/admin/google-business.functions";

export const Route = createFileRoute("/_authenticated/admin/google-business")({
  component: AdminGoogleBusiness,
});

const METRIC_LABELS: Record<string, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "Desktop Maps views",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "Desktop Search views",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "Mobile Maps views",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "Mobile Search views",
  BUSINESS_CONVERSATIONS: "Messages started",
  BUSINESS_DIRECTION_REQUESTS: "Direction requests",
  CALL_CLICKS: "Phone calls",
  WEBSITE_CLICKS: "Website clicks",
};

function sumSeries(series: { timeSeries?: { datedValues?: Array<{ value?: string }> } }): number {
  return (series.timeSeries?.datedValues ?? []).reduce((sum, v) => sum + Number(v.value ?? 0), 0);
}

function AdminGoogleBusiness() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = Route.useRouteContext();
  const doStartConnect = useServerFn(startGoogleBusinessConnect);
  const doDisconnect = useServerFn(disconnectGoogleBusiness);
  const doSelectLocation = useServerFn(selectGoogleBusinessLocation);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const connected = params.get("connected");
    if (error) {
      const messages: Record<string, string> = {
        invalid_state: "Connection expired or was tampered with — try connecting again.",
        no_refresh_token: "Google didn't return a refresh token — try disconnecting any prior access at https://myaccount.google.com/permissions and connect again.",
        exchange_failed: "Failed to complete the connection with Google.",
        missing_code: "Google didn't return an authorization code.",
      };
      toast.error(messages[error] ?? `Connection failed: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (connected) {
      toast.success("Google Business Profile connected");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const statusQuery = useQuery({
    queryKey: ["gbp-status"],
    queryFn: () => getGoogleBusinessStatus(),
  });

  const locationsQuery = useQuery({
    queryKey: ["gbp-locations"],
    queryFn: () => listGoogleBusinessLocations(),
    enabled: Boolean(statusQuery.data?.connected && !statusQuery.data?.locationName),
  });

  const infoQuery = useQuery({
    queryKey: ["gbp-info"],
    queryFn: () => getGoogleBusinessInfo(),
    enabled: Boolean(statusQuery.data?.locationName),
  });

  const insightsQuery = useQuery({
    queryKey: ["gbp-insights"],
    queryFn: () => getGoogleBusinessInsights(),
    enabled: Boolean(statusQuery.data?.locationName),
  });

  const reviewsQuery = useQuery({
    queryKey: ["gbp-reviews"],
    queryFn: () => getGoogleBusinessReviews(),
    enabled: Boolean(statusQuery.data?.locationName),
    retry: false,
  });

  function refreshStatus() {
    queryClient.invalidateQueries({ queryKey: ["gbp-status"] });
    queryClient.invalidateQueries({ queryKey: ["gbp-locations"] });
    queryClient.invalidateQueries({ queryKey: ["gbp-info"] });
    queryClient.invalidateQueries({ queryKey: ["gbp-insights"] });
    queryClient.invalidateQueries({ queryKey: ["gbp-reviews"] });
  }

  async function connect() {
    setConnecting(true);
    try {
      const { url } = await doStartConnect();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start connection");
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Business Profile? You'll need to reconnect and re-select the location.")) return;
    try {
      await doDisconnect();
      toast.success("Disconnected");
      refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }

  async function pickLocation(loc: { accountName: string; locationName: string; title: string }) {
    try {
      await doSelectLocation({
        data: { accountName: loc.accountName, locationName: loc.locationName, locationTitle: loc.title },
      });
      toast.success(`Using "${loc.title}"`);
      refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to select location");
    }
  }

  const status = statusQuery.data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Business Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Business info, performance insights, and reviews pulled live from your connected Google account.
          </p>
        </div>
        {status?.connected && isSuperAdmin && (
          <button
            onClick={disconnect}
            className="flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Unplug className="h-4 w-4" /> Disconnect
          </button>
        )}
      </div>

      {statusQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {statusQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="text-lg font-semibold text-destructive">Failed to load connection status</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "Unknown error — check that the google_business_connection migration has been run in Supabase."}
          </p>
        </div>
      )}

      {status && !status.connected && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Not connected</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Connect your Google account to pull live business info, performance insights, and reviews into this
            dashboard.
          </p>
          <button
            onClick={connect}
            disabled={connecting}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {connecting ? "Redirecting…" : "Connect Google Business Profile"}
          </button>
        </div>
      )}

      {status?.connected && !status.locationName && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Select a location</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Google account manages the location(s) below — pick the one for this site.
          </p>
          {locationsQuery.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading locations…</p>}
          {locationsQuery.isError && (
            <p className="mt-4 text-sm text-destructive">
              {locationsQuery.error instanceof Error ? locationsQuery.error.message : "Failed to load locations"}
            </p>
          )}
          <div className="mt-4 space-y-2">
            {locationsQuery.data?.map((loc) => (
              <button
                key={loc.locationName}
                onClick={() => pickLocation(loc)}
                className="flex w-full items-center gap-2 rounded-md border border-border px-4 py-3 text-left text-sm hover:border-primary/40 hover:bg-muted"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" /> {loc.title}
              </button>
            ))}
            {locationsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No locations found on this Google account.</p>
            )}
          </div>
        </div>
      )}

      {status?.connected && status.locationName && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-medium">{status.locationTitle}</span>
              <span className="text-muted-foreground">connected</span>
            </div>
          </div>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Business info</h2>
            {infoQuery.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
            {infoQuery.isError && (
              <p className="mt-3 text-sm text-destructive">
                {infoQuery.error instanceof Error ? infoQuery.error.message : "Failed to load business info"}
              </p>
            )}
            {infoQuery.data && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {infoQuery.data.phoneNumbers?.primaryPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" /> {infoQuery.data.phoneNumbers.primaryPhone}
                  </div>
                )}
                {infoQuery.data.websiteUri && (
                  <a
                    href={infoQuery.data.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" /> {infoQuery.data.websiteUri}
                  </a>
                )}
                {infoQuery.data.storefrontAddress && (
                  <div className="flex items-start gap-2 text-sm sm:col-span-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      {[
                        ...(infoQuery.data.storefrontAddress.addressLines ?? []),
                        infoQuery.data.storefrontAddress.locality,
                        infoQuery.data.storefrontAddress.administrativeArea,
                        infoQuery.data.storefrontAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Performance (last 30 days)</h2>
            </div>
            {insightsQuery.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
            {insightsQuery.isError && (
              <p className="mt-3 text-sm text-destructive">
                {insightsQuery.error instanceof Error ? insightsQuery.error.message : "Failed to load insights"}
              </p>
            )}
            {insightsQuery.data && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {insightsQuery.data.map((series) => (
                  <div key={series.dailyMetric} className="rounded-lg border border-border p-4">
                    <div className="text-2xl font-bold">{sumSeries(series)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {METRIC_LABELS[series.dailyMetric] ?? series.dailyMetric}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Reviews</h2>
            </div>
            {reviewsQuery.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
            {reviewsQuery.isError && (
              <div className="mt-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
                <p className="text-muted-foreground">
                  Reviews aren't available through Google's current Business Profile API for this account — Google
                  restricts review data access for most developers.
                </p>
                <a
                  href="https://business.google.com/reviews"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  View reviews on Google Business Profile <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {reviewsQuery.data && (
              <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted/40 p-4 text-xs">
                {JSON.stringify(reviewsQuery.data, null, 2)}
              </pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
