// Server-only. Shared by every outgoing-email template (posts-mailer,
// inquiries-notify, inquiry-comments) so the same site logo an admin
// uploads in Settings shows up consistently across all of them, instead of
// each template hand-rolling its own header.
import type { SupabaseClient } from "@supabase/supabase-js";

// Same admin-uploaded logo used across the public site (see
// site_settings.logo_url in src/lib/admin/branding.functions.ts) — null
// until an admin sets one, in which case callers fall back to their
// existing plain-text/emoji header instead of a broken <img>.
export async function getSiteLogoUrl(supabaseAdmin: SupabaseClient): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("logo_url")
    .eq("id", 1)
    .single();
  return data?.logo_url ?? null;
}

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

// A small centered logo, meant to sit above an email's existing <h2>
// title — kept deliberately plain (no colored banner) so it drops into
// the simpler transactional templates (inquiry notifications, admin-reply
// notifications) without a redesign. posts-mailer.server.ts's own
// colored hero banner embeds the logo differently, inline in its markup.
export function logoHeaderHtml(logoUrl: string | null): string {
  if (!logoUrl) return "";
  return `<div style="text-align:center;margin-bottom:14px;"><img src="${esc(logoUrl)}" alt="KL2J Land Surveying and Engineering Services" style="height:44px;width:auto;" /></div>`;
}
