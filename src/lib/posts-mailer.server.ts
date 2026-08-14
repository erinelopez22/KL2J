// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).
import { ctaForPost } from "@/lib/postCta";

export type PostType = "project" | "service" | "profile" | "update";

export const POST_TYPE_META: Record<PostType, { label: string; accentColor: string }> = {
  project: { label: "New Project Completed", accentColor: "#8b1e1e" },
  service: { label: "New Service", accentColor: "#1e5f8b" },
  profile: { label: "Company Update", accentColor: "#8b6f1e" },
  update: { label: "Update from KL2J", accentColor: "#3a3a3a" },
};

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export type PostAttachment = {
  url: string;
  name: string;
  contentType: string;
  kind: "image" | "video" | "document";
};

export type PostForEmail = {
  type: PostType;
  title: string;
  subject: string;
  body_html: string; // already sanitized before this point — inserted verbatim
  project_ids: string[];
  attachments: PostAttachment[];
};

function attachmentsHtml(attachments: PostAttachment[]): string {
  if (attachments.length === 0) return "";
  const items = attachments
    .map((a) => {
      if (a.kind === "image") {
        return `<img src="${esc(a.url)}" alt="${esc(a.name)}" style="display:block;width:100%;max-width:528px;border-radius:8px;margin-top:10px;" />`;
      }
      const linkLabel =
        a.kind === "video" ? `▶ Watch video: ${esc(a.name)}` : `📄 Open file: ${esc(a.name)}`;
      return `<a href="${esc(a.url)}" style="display:block;margin-top:10px;padding:10px 14px;border-radius:8px;background:#f2f2f2;color:#111;text-decoration:none;font-size:13px;font-weight:600;">${linkLabel}</a>`;
    })
    .join("");
  return `<div style="margin-top:8px;">${items}</div>`;
}

function ctaHtml(post: Pick<PostForEmail, "type" | "project_ids">, accentColor: string): string {
  const cta = ctaForPost(post.type, post.project_ids);
  return `
  <div style="margin-top:24px;">
    <a href="${esc(cta.url)}" style="display:inline-block;padding:10px 20px;border-radius:6px;background:${accentColor};color:#fff;text-decoration:none;font-size:14px;font-weight:600;">
      ${esc(cta.label)} →
    </a>
  </div>`;
}

export function buildPostEmailHtml(post: PostForEmail): string {
  const meta = POST_TYPE_META[post.type];
  return `
<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111;">
  <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${meta.accentColor}1a;color:${meta.accentColor};font-size:12px;font-weight:600;letter-spacing:0.02em;">
    ${esc(meta.label.toUpperCase())}
  </div>
  <h2 style="margin:12px 0 16px;color:${meta.accentColor};">${esc(post.title)}</h2>
  <div style="font-size:14px;line-height:1.6;">
    ${post.body_html}
  </div>
  ${attachmentsHtml(post.attachments)}
  ${ctaHtml(post, meta.accentColor)}
  <p style="margin-top:28px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#999;">
    You're receiving this because you previously contacted KL2J Land Surveying and Engineering Services.
  </p>
</div>`.trim();
}

export async function sendPostToRecipient(
  post: PostForEmail,
  recipient: { email: string; name?: string | null },
): Promise<void> {
  const { sendMail } = await import("@/lib/mailer.server");
  await sendMail({
    to: recipient.email,
    subject: post.subject,
    html: buildPostEmailHtml(post),
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
