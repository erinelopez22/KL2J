// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

// Best-effort — a failed storage cleanup should never fail the row delete
// it's attached to, so this logs rather than throws.
export async function removeStoragePaths(bucket: string, paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage.from(bucket).remove(unique);
  if (error) console.error(`removeStoragePaths(${bucket}) failed`, error);
}
