import { BrevoClient } from "@getbrevo/brevo";

// Each feature sends from its own address (all on the same verified domain,
// so no extra DNS work) — keeps inbound replies naturally sorted by which
// part of the app they're about.
export const FROM_INQUIRY = "KL2J Land Surveying <inquiry@kl2jlandsurveying.com>";
export const FROM_ADMIN = "KL2J Land Surveying <admin@kl2jlandsurveying.com>";
export const FROM_NOTIFICATION = "KL2J Land Surveying <notification@kl2jlandsurveying.com>";

let _brevo: BrevoClient | undefined;

function getBrevo(): BrevoClient {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("Email sender not configured (missing BREVO_API_KEY)");
  }
  if (!_brevo) _brevo = new BrevoClient({ apiKey });
  return _brevo;
}

// Parses the "Display Name <email@domain>" format callers already use into
// the {email, name} shape Brevo's API wants.
function parseAddress(value: string): { email: string; name?: string } {
  const match = value.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    const name = match[1].trim();
    return { email: match[2].trim(), name: name || undefined };
  }
  return { email: value.trim() };
}

// Brevo runs its own personalization/template parser over `subject` and
// `htmlContent` on every send — looking for `{{ ... }}` — even when we
// never use Brevo templating ourselves and pass fully-rendered content. A
// stray `{`/`}` typed by an admin (a post title) or a customer (an inquiry
// message quoted back into a notification email) is enough to make that
// parser choke and reject the whole send with a cryptic parse error.
// None of our own template markup ever needs a literal curly brace, so
// swapping user-typed ones for visually-identical fullwidth lookalikes
// here neutralizes this everywhere, in one place, without changing what
// the words say.
function neutralizeBrevoTemplateSyntax(value: string): string {
  return value.replace(/\{/g, "｛").replace(/\}/g, "｝");
}

export async function sendMail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ response: string }> {
  const brevo = getBrevo();

  const result = await brevo.transactionalEmails.sendTransacEmail({
    sender: parseAddress(opts.from),
    to: [parseAddress(opts.to)],
    subject: neutralizeBrevoTemplateSyntax(opts.subject),
    htmlContent: neutralizeBrevoTemplateSyntax(opts.html),
    replyTo: opts.replyTo ? parseAddress(opts.replyTo) : undefined,
  });

  return { response: result.messageId ?? "" };
}
