import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateBranding } from "@/lib/admin/branding.functions";
import { QuickImageUpload } from "@/components/admin/QuickImageUpload";
import { FloatingToolbar } from "@/components/admin/FloatingToolbar";
import { EditModeProvider } from "@/lib/editMode";
import { LandingPage } from "@/routes/index";
import logoUrl from "@/assets/kl2j-logo.jpg";

export const Route = createFileRoute("/_authenticated/admin/preview")({
  component: AdminPreview,
});

function AdminPreview() {
  const [zoom, setZoom] = useState(1);
  const queryClient = useQueryClient();
  const doUpdateBranding = useServerFn(updateBranding);

  const { data: favicon } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as unknown as { favicon_url: string | null };
    },
  });

  return (
    <div>
      <FloatingToolbar>
        <div className="flex items-center gap-1 border-r border-border pr-2">
          <img
            src={favicon?.favicon_url || logoUrl}
            alt="Favicon"
            className="h-5 w-5 rounded object-cover"
          />
          <QuickImageUpload
            folder="branding"
            label="Replace favicon"
            iconOnly
            className="!bg-transparent !text-foreground hover:!bg-muted"
            onUploaded={async (url) => {
              await doUpdateBranding({ data: { favicon_url: url } });
              queryClient.invalidateQueries({ queryKey: ["site-settings"] });
            }}
          />
        </div>
        <div className="flex items-center gap-1 border-r border-border pr-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
            className="rounded p-1.5 hover:bg-muted"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
            className="rounded p-1.5 hover:bg-muted"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded p-1.5 hover:bg-muted"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
        </a>
      </FloatingToolbar>

      <div style={{ zoom } as React.CSSProperties}>
        <EditModeProvider value={{ editable: true }}>
          <LandingPage />
        </EditModeProvider>
      </div>
    </div>
  );
}
