import nodemailer from "nodemailer";

let _transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;

  if (!user || !pass) return null;

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return _transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ response: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("Email sender not configured (missing GMAIL_SMTP_USER or GMAIL_SMTP_APP_PASSWORD)");
  }

  const info = await transporter.sendMail({
    from: `KL2J Website <${process.env.GMAIL_SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });
  return { response: info.response };
}
