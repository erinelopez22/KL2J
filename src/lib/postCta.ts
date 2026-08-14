// Shared by the admin PostEditor (live preview of the auto-generated link)
// and posts-mailer.server.ts (the actual email CTA button) — plain client
// + server safe module, no secrets, so no .server.ts restriction here.

// TODO: swap to the custom domain once one is set up for the site (same
// placeholder used in src/lib/inquiries-notify.server.ts).
const SITE_URL = "https://kl2j--kl2j-98e80.us-central1.hosted.app";

export type PostCta = { label: string; url: string };

export function ctaForPost(
  type: "project" | "service" | "profile" | "update",
  projectIds: string[],
): PostCta {
  if (type === "service") {
    return { label: "View our services", url: `${SITE_URL}/#services` };
  }
  if (type === "project") {
    if (projectIds.length === 1) {
      return { label: "View this project", url: `${SITE_URL}/?project=${projectIds[0]}#projects` };
    }
    return { label: "View our projects", url: `${SITE_URL}/#projects` };
  }
  // profile ("Company update") and update ("General update") both point at
  // the homepage — neither has a more specific section to deep-link to.
  return { label: "Visit our website", url: `${SITE_URL}/` };
}
