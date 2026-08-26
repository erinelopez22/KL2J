import { Resend } from "resend";

const FROM_ADDRESS = "KL2J Land Surveying <notifications@kl2jlandsurveying.com>";

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
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ response: string }> {
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
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
