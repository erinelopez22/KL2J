// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).
import { ctaForPost, type PostType } from "@/lib/postCta";

export type { PostType };

type TypeMeta = {
  label: string;
  accentColor: string;
  accentColorSoft: string; // gradient end / lighter shade of accentColor
  emoji: string;
  tagline: string;
};

export const POST_TYPE_META: Record<PostType, TypeMeta> = {
  project: {
    label: "Project Completed",
    accentColor: "#8b1e1e",
    accentColorSoft: "#b23a3a",
    emoji: "🏗️",
    tagline: "Another project delivered with precision and care.",
  },
  service: {
    label: "New Service",
    accentColor: "#1e5f8b",
    accentColorSoft: "#3a7fad",
    emoji: "🛠️",
    tagline: "Something new to help you get the job done.",
  },
  profile: {
    label: "Company Update",
    accentColor: "#8b6f1e",
    accentColorSoft: "#ad9440",
    emoji: "🏢",
    tagline: "News from the KL2J team.",
  },
  update: {
    label: "Latest Update",
    accentColor: "#3a3a3a",
    accentColorSoft: "#5c5c5c",
    emoji: "📢",
    tagline: "Here's what's new.",
  },
  promotion: {
    label: "Special Offer",
    accentColor: "#c2410c",
    accentColorSoft: "#ea580c",
    emoji: "🎉",
    tagline: "A limited-time offer, just for you.",
  },
  testimonial: {
    label: "Customer Spotlight",
    accentColor: "#b45309",
    accentColorSoft: "#d97706",
    emoji: "⭐",
    tagline: "Hear it from one of our clients.",
  },
  credentials: {
    label: "Credentials Update",
    accentColor: "#0f766e",
    accentColorSoft: "#14b8a6",
    emoji: "🎓",
    tagline: "Keeping our standards verified and up to date.",
  },
  team: {
    label: "Team Update",
    accentColor: "#4338ca",
    accentColorSoft: "#6366f1",
    emoji: "👥",
    tagline: "News from the people behind KL2J.",
  },
  event: {
    label: "Event",
    accentColor: "#7c3aed",
    accentColorSoft: "#a78bfa",
    emoji: "📅",
    tagline: "Mark your calendar.",
  },
  deadline: {
    label: "Reminder",
    accentColor: "#b91c1c",
    accentColorSoft: "#dc2626",
    emoji: "⏰",
    tagline: "A friendly heads-up before time runs out.",
  },
  partnership: {
    label: "New Partnership",
    accentColor: "#0e7490",
    accentColorSoft: "#0891b2",
    emoji: "🤝",
    tagline: "Growing our network to serve you better.",
  },
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
  coverPhotoUrl?: string | null;
};

// A gradient banner with a big emoji badge, a small uppercase kicker label,
// the post title, and a short type-flavored tagline. `background-color` is
// set alongside `background-image` so clients that don't render gradients
// (older Outlook) still get a solid, on-brand color instead of white.
//
// When a cover photo is set, it REPLACES this solid-color banner — the
// photo becomes the background and the same badge/kicker/title/tagline
// render on top of it in white, instead of on a flat accent-colored
// background. `background-size:cover` fills the header edge-to-edge (no
// letterboxing); `background-position:left top` anchors the crop to the
// top-left corner instead of centering it, since that's where cover photos
// tend to have a logo baked in — cropping trims the right/bottom instead.
function heroHtml(meta: TypeMeta, title: string, coverPhotoUrl?: string | null): string {
  if (coverPhotoUrl) {
    return `
    <div style="background-color:${meta.accentColor};background-image:url('${esc(coverPhotoUrl)}');background-size:cover;background-repeat:no-repeat;background-position:left top;padding:40px 28px 32px;text-align:center;">
      <div style="display:inline-block;width:60px;height:60px;line-height:60px;border-radius:50%;background:rgba(255,255,255,0.18);font-size:30px;">${meta.emoji}</div>
      <div style="margin-top:14px;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;text-shadow:0 1px 3px rgba(0,0,0,0.5);">${esc(meta.label)}</div>
      <h1 style="margin:10px 0 0;color:#ffffff;font-size:23px;font-weight:800;line-height:1.35;text-shadow:0 1px 4px rgba(0,0,0,0.5);">${esc(title)}</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.92);font-size:13px;text-shadow:0 1px 3px rgba(0,0,0,0.5);">${esc(meta.tagline)}</p>
    </div>`;
  }
  return `
  <div style="background-color:${meta.accentColor};background-image:linear-gradient(135deg, ${meta.accentColor}, ${meta.accentColorSoft});padding:40px 28px 32px;text-align:center;">
    <div style="display:inline-block;width:60px;height:60px;line-height:60px;border-radius:50%;background:rgba(255,255,255,0.18);font-size:30px;">${meta.emoji}</div>
    <div style="margin-top:14px;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.85;">${esc(meta.label)}</div>
    <h1 style="margin:10px 0 0;color:#ffffff;font-size:23px;font-weight:800;line-height:1.35;">${esc(title)}</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,0.88);font-size:13px;">${esc(meta.tagline)}</p>
  </div>`;
}

// The admin's rich-text body, wrapped in a type-flavored card so the same
// content reads differently depending on what it's announcing — a quote
// card for testimonials, a dashed "coupon" for promotions, an alert strip
// for deadlines, and so on. Falls back to a plain padded block otherwise.
function bodyCardHtml(type: PostType, bodyHtml: string, meta: TypeMeta): string {
  const textStyle = "font-size:15px;line-height:1.7;color:#242424;";
  switch (type) {
    case "testimonial":
      return `
      <div style="margin:22px 0;padding:26px 24px 22px;background:#fffbeb;border-left:4px solid ${meta.accentColor};border-radius:10px;">
        <div style="font-size:38px;line-height:1;color:${meta.accentColor};opacity:0.35;font-family:Georgia,'Times New Roman',serif;">&ldquo;</div>
        <div style="${textStyle}font-style:italic;margin-top:-10px;">${bodyHtml}</div>
        <div style="margin-top:14px;color:${meta.accentColor};font-size:17px;letter-spacing:3px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
      </div>`;
    case "promotion":
      return `
      <div style="margin:22px 0;padding:22px 22px;background:#fff7ed;border:2px dashed ${meta.accentColor};border-radius:14px;">
        <div style="${textStyle}">${bodyHtml}</div>
      </div>`;
    case "deadline":
      return `
      <div style="margin:22px 0;padding:20px 22px;background:#fef2f2;border-left:4px solid ${meta.accentColor};border-radius:10px;">
        <div style="${textStyle}">${bodyHtml}</div>
      </div>`;
    case "event":
      return `
      <div style="margin:22px 0;padding:20px 22px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:14px;">
        <div style="${textStyle}">${bodyHtml}</div>
      </div>`;
    case "credentials":
      return `
      <div style="margin:22px 0;padding:20px 22px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:14px;">
        <div style="${textStyle}">${bodyHtml}</div>
      </div>`;
    default:
      return `<div style="margin:20px 0;${textStyle}">${bodyHtml}</div>`;
  }
}

function attachmentsHtml(attachments: PostAttachment[]): string {
  if (attachments.length === 0) return "";
  const items = attachments
    .map((a) => {
      if (a.kind === "image") {
        return `<img src="${esc(a.url)}" alt="${esc(a.name)}" style="display:block;width:100%;max-width:100%;border-radius:12px;margin-top:14px;" />`;
      }
      const linkLabel =
        a.kind === "video"
          ? `&#9654;&nbsp; Watch video — ${esc(a.name)}`
          : `&#128196;&nbsp; Open file — ${esc(a.name)}`;
      return `<a href="${esc(a.url)}" style="display:block;margin-top:10px;padding:12px 16px;border-radius:10px;background:#f7f7f8;border:1px solid #ececec;color:#111;text-decoration:none;font-size:13px;font-weight:600;">${linkLabel}</a>`;
    })
    .join("");
  return `<div style="margin-top:6px;">${items}</div>`;
}

function ctaHtml(post: Pick<PostForEmail, "type" | "project_ids">, accentColor: string): string {
  const cta = ctaForPost(post.type, post.project_ids);
  return `
  <div style="margin-top:26px;text-align:center;">
    <a href="${esc(cta.url)}" style="display:inline-block;padding:13px 30px;border-radius:999px;background-color:${accentColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
      ${esc(cta.label)} &nbsp;&rarr;
    </a>
  </div>`;
}

export function buildPostEmailHtml(post: PostForEmail): string {
  const meta = POST_TYPE_META[post.type];
  return `
<div style="background:#f4f4f5;padding:32px 12px;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    ${heroHtml(meta, post.title, post.coverPhotoUrl)}
    <div style="padding:6px 28px 30px;">
      ${bodyCardHtml(post.type, post.body_html, meta)}
      ${attachmentsHtml(post.attachments)}
      ${ctaHtml(post, meta.accentColor)}
    </div>
    <div style="padding:18px 28px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
        You're receiving this because you previously contacted KL2J Land Surveying and Engineering Services.
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#bbb;font-weight:600;letter-spacing:0.04em;">
        KL2J LAND SURVEYING AND ENGINEERING SERVICES
      </p>
    </div>
  </div>
</div>`.trim();
}

export async function sendPostToRecipient(
  post: PostForEmail,
  recipient: { email: string; name?: string | null },
): Promise<{ response: string }> {
  const { sendMail } = await import("@/lib/mailer.server");
  return sendMail({
    to: recipient.email,
    subject: post.subject,
    html: buildPostEmailHtml(post),
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
