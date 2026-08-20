import { supabase } from "@/integrations/supabase/client";

type MintResult = { path: string; token: string; contentType: string; url?: string };
type MintFn = (input: { data: Record<string, unknown> }) => Promise<MintResult>;

// Uploads a file straight from the browser to Supabase Storage using a
// signed URL minted server-side via `mint` — the file's bytes never pass
// through the app server, so this isn't subject to Cloud Run's request
// body size limit.
export async function uploadFileDirect(
  mint: MintFn,
  bucket: "site-media" | "confidential-media",
  file: File,
  extra: Record<string, unknown> = {},
): Promise<MintResult> {
  const minted = await mint({
    data: { filename: file.name, contentType: file.type, size: file.size, ...extra },
  });
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(minted.path, minted.token, file, { contentType: minted.contentType });
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  return minted;
}
