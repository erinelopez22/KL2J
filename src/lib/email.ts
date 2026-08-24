import { z } from "zod";

// Mirrors the exact check the server applies via `z.string().email()`, so a
// value accepted here is guaranteed to pass server-side validation too.
const EmailSchema = z.string().trim().email();

export function isValidEmail(value: string): boolean {
  return EmailSchema.safeParse(value).success;
}

export function normalizeEmail(value: string): string {
  return value.trim();
}
