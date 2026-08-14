import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateBranding } from "@/lib/admin/branding.functions";
import { FileDrop } from "@/components/admin/FileDrop";
import logoUrl from "@/assets/kl2j-logo.jpg";
import bannerUrl from "@/assets/kl2j-banner.jpg";

export const Route = createFileRoute("/_authenticated/admin/branding")({
  component: AdminBranding,
});

type SiteSettings = { logo_url: string | null; favicon_url: string | null; hero_banner_url: string | null };

function AdminBranding() {
  const queryClient = useQueryClient();
  const doUpdate = useServerFn(updateBranding);

  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as SiteSettings;
    },
  });

  async function save(field: "logo_url" | "favicon_url" | "hero_banner_url", url: string) {
    try {
      await doUpdate({ data: { [field]: url } });
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Branding updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  const items: { key: "logo_url" | "favicon_url" | "hero_banner_url"; label: string; fallback: string }[] = [
    { key: "logo_url", label: "Logo", fallback: logoUrl },
    { key: "favicon_url", label: "Favicon", fallback: logoUrl },
    { key: "hero_banner_url", label: "Hero banner", fallback: bannerUrl },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Branding</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update the logo, favicon, and hero banner shown across the site.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {items.map((item) => {
          const current = data?.[item.key] || item.fallback;
          return (
            <div key={item.key} className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">{item.label}</div>
              <img
                src={current}
                alt={item.label}
                className="mt-3 h-32 w-full rounded-lg border border-border object-cover"
              />
              <div className="mt-3">
                <FileDrop
                  folder="branding"
                  label="Replace image"
                  allowExternalLink={false}
                  multiple={false}
                  onUploaded={(result) => save(item.key, result.url)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
