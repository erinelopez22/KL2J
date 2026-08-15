// Shared by the admin PostEditor (live preview of the auto-generated link)
// and posts-mailer.server.ts (the actual email CTA button) — plain client
// + server safe module, no secrets, so no .server.ts restriction here.

// TODO: swap to the custom domain once one is set up for the site (same
// placeholder used in src/lib/inquiries-notify.server.ts).
const SITE_URL = "https://kl2j--kl2j-98e80.us-central1.hosted.app";

export type PostType =
  | "project"
  | "service"
  | "profile"
  | "update"
  | "promotion"
  | "testimonial"
  | "credentials"
  | "team"
  | "event"
  | "deadline"
  | "partnership";

export type PostCta = { label: string; url: string };

export function ctaForPost(type: PostType, projectIds: string[]): PostCta {
  if (type === "service") {
    return { label: "View our services", url: `${SITE_URL}/#services` };
  }
  if (type === "project") {
    if (projectIds.length === 1) {
      return { label: "View this project", url: `${SITE_URL}/?project=${projectIds[0]}#projects` };
    }
    return { label: "View our projects", url: `${SITE_URL}/#projects` };
  }
  if (type === "testimonial") {
    return { label: "Read customer reviews", url: `${SITE_URL}/#reviews` };
  }
  if (type === "credentials") {
    return { label: "View our credentials", url: `${SITE_URL}/#credentials` };
  }
  if (type === "promotion" || type === "event" || type === "deadline") {
    return { label: "Get in touch", url: `${SITE_URL}/#contact` };
  }
  // profile ("Company update"), update ("General update"), team, and
  // partnership all point at the homepage — none has a more specific
  // section to deep-link to.
  return { label: "Visit our website", url: `${SITE_URL}/` };
}
