// Shared by both the admin RecipientPicker (client-side preview/count) and
// posts.functions.ts (server-side source of truth) so the number the admin
// sees before saving always matches what actually gets inserted.
export function dedupeContactsByEmail<T extends { email: string | null; created_at: string }>(
  rows: T[],
): T[] {
  const byEmail = new Map<string, T>();
  for (const row of rows) {
    if (!row.email) continue;
    const key = row.email.trim().toLowerCase();
    const existing = byEmail.get(key);
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      byEmail.set(key, row);
    }
  }
  return Array.from(byEmail.values());
}
