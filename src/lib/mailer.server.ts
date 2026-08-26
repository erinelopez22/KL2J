import { Resend } from "resend";

// Each feature sends from its own address (all on the same verified domain,
// so no extra DNS work) — keeps inbound replies naturally sorted by which
// part of the app they're about.
export const FROM_INQUIRY = "KL2J Land Surveying <inquiry@kl2jlandsurveying.com>";
export const FROM_ADMIN = "KL2J Land Surveying <admin@kl2jlandsurveying.com>";
export const FROM_NOTIFICATION = "KL2J Land Surveying <notification@kl2jlandsurveying.com>";

let _resend: Resend | undefined;

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email sender not configured (missing RESEND_API_KEY)");
  }
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

export async function sendMail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ response: string }> {
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email via Resend");
  }

  return { response: data?.id ?? "" };
}
