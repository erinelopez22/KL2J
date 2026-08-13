import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addPartnerCompany, deletePartnerCompany } from "@/lib/admin/companies.functions";
import { FileDrop } from "@/components/admin/FileDrop";
import { useConfirm } from "@/components/ConfirmDialogProvider";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  component: AdminCompanies,
});

type Company = {
  id: string;
  name: string;
  logo_url: string;
  storage_path: string | null;
  website_url: string | null;
  sort_order: number;
};

function AdminCompanies() {
  const queryClient = useQueryClient();
  const doAdd = useServerFn(addPartnerCompany);
  const doDelete = useServerFn(deletePartnerCompany);
  const confirm = useConfirm();
  const [pending, setPending] = useState<{ url: string; path: string } | null>(null);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partner_companies").select("*").order("sort_order");
      if (error) throw error;
      return data as Company[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    queryClient.invalidateQueries({ queryKey: ["public-companies"] });
  }

  async function save() {
    if (!pending || !name.trim()) {
      toast.error("Upload a logo and enter a name first");
      return;
    }
    try {
      await doAdd({
        data: {
          name: name.trim(),
          logo_url: pending.url,
          storage_path: pending.path,
          website_url: websiteUrl.trim() || undefined,
          sort_order: (companies?.length ?? 0) + 1,
        },
      });
      toast.success("Company saved");
      setPending(null);
      setName("");
      setWebsiteUrl("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save company");
    }
  }

  async function remove(company: Company) {
    if (!(await confirm("Remove this company? This cannot be undone.", { destructive: true }))) return;
    try {
      await doDelete({ data: { id: company.id, storage_path: company.storage_path ?? undefined } });
      toast.success("Company removed");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Tied-up Companies</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Partner/tied-up company logos shown near the bottom of the public site.
      </p>

      <div className="mt-6 max-w-md rounded-xl border border-border bg-card p-4">
        <FileDrop
          folder="companies"
          label={pending ? "Logo ready — fill details below" : "Upload a company logo"}
          onUploaded={setPending}
        />
        <div className="mt-3 grid gap-3">
          <input
            placeholder="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            placeholder="Website URL (optional)"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          />
          <button
            onClick={save}
            disabled={!pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save company
          </button>
        </div>
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      <div className="mt-6 max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
        {companies?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-white p-1.5">
              {c.logo_url ? (
                <img src={c.logo_url} alt={c.name} className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{c.name}</div>
              {c.website_url && (
                <a
                  href={c.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-1 text-xs text-primary hover:underline"
                >
                  <span className="min-w-0 break-all">{c.website_url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </div>
            <button
              onClick={() => remove(c)}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {companies?.length === 0 && <p className="text-sm text-muted-foreground">No companies added yet.</p>}
      </div>
    </div>
  );
}
