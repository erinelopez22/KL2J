// Server-only. Signs/verifies the per-recipient token embedded in Posts
// unsubscribe links, so nobody can unsubscribe someone else's address by
// guessing/crafting a URL — the token is an HMAC of the (normalized) email,
// only reproducible with the server secret.
import crypto from "node:crypto";

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("Missing UNSUBSCRIBE_SECRET");
  return secret;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function generateUnsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", getSecret()).update(normalize(email)).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
