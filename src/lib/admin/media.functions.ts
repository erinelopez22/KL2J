import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = ["application/pdf"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const FOLDER_RULES: Record<string, { types: string[]; maxBytes: number }> = {
  branding: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
  gallery: { types: [...IMAGE_TYPES, ...VIDEO_TYPES], maxBytes: 50 * 1024 * 1024 },
  documents: { types: [...IMAGE_TYPES, ...DOC_TYPES], maxBytes: 10 * 1024 * 1024 },
  projects: { types: [...IMAGE_TYPES, ...DOC_TYPES, ...VIDEO_TYPES], maxBytes: 50 * 1024 * 1024 },
  companies: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
};

const UploadSchema = z.object({
  folder: z.enum(["branding", "gallery", "documents", "projects", "companies"]),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1),
  base64: z.string().min(1),
});

export const uploadSiteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const rule = FOLDER_RULES[data.folder];
    if (!rule.types.includes(data.contentType)) {
      throw new Error(`Unsupported file type: ${data.contentType}`);
    }

    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.byteLength > rule.maxBytes) {
      throw new Error(`File too large (max ${Math.round(rule.maxBytes / 1024 / 1024)}MB)`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.folder}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("site-media")
      .upload(path, buffer, { contentType: data.contentType, upsert: false });
    if (uploadErr) {
      console.error("uploadSiteMedia failed", uploadErr);
      throw new Error(`Upload failed: ${uploadErr.message}`);
    }

    const { data: pub } = supabaseAdmin.storage.from("site-media").getPublicUrl(path);
    return { url: pub.publicUrl, path, contentType: data.contentType };
  });

const CONFIDENTIAL_TYPES = [...IMAGE_TYPES, ...DOC_TYPES, ...VIDEO_TYPES];
const CONFIDENTIAL_MAX_BYTES = 50 * 1024 * 1024;

const ConfidentialUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1),
  base64: z.string().min(1),
});

// Confidential files live in a PRIVATE bucket (never publicly readable) and
// are never returned by the public projects query — only accessible here,
// admin-role-gated, and viewed via short-lived signed URLs.
export const uploadConfidentialMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConfidentialUploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    if (!CONFIDENTIAL_TYPES.includes(data.contentType)) {
      throw new Error(`Unsupported file type: ${data.contentType}`);
    }
    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.byteLength > CONFIDENTIAL_MAX_BYTES) {
      throw new Error(`File too large (max ${Math.round(CONFIDENTIAL_MAX_BYTES / 1024 / 1024)}MB)`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `projects/${Date.now()}-${safeName}`;

    const { error } = await supabaseAdmin.storage
      .from("confidential-media")
      .upload(path, buffer, { contentType: data.contentType, upsert: false });
    if (error) {
      console.error("uploadConfidentialMedia failed", error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    return { path, contentType: data.contentType };
  });

export const getConfidentialFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("confidential-media")
      .createSignedUrl(data.path, 300);
    if (error || !signed) {
      console.error("getConfidentialFileUrl failed", error);
      throw new Error("Failed to get file link");
    }
    return { url: signed.signedUrl };
  });

export const deleteConfidentialMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("confidential-media").remove([data.path]);
    if (error) {
      console.error("deleteConfidentialMedia failed", error);
      throw new Error(`Delete failed: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteSiteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("site-media").remove([data.path]);
    if (error) {
      console.error("deleteSiteMedia failed", error);
      throw new Error(`Delete failed: ${error.message}`);
    }
    return { ok: true };
  });
