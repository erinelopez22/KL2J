import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = ["application/pdf"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
// Broad-but-curated "any file a business post would realistically attach" —
// deliberately excludes executable/script/html content types since these
// land in a publicly-readable storage bucket.
const OFFICE_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
];

// Kept in sync with MAX_ADMIN_UPLOAD_BYTES in src/lib/uploadLimits.ts. File
// bytes never pass through this server — the browser uploads straight to
// Supabase Storage using a token minted here, so this is just an app-level
// sanity ceiling, not a Cloud Run request-body constraint.
const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024;

const FOLDER_RULES: Record<string, { types: string[]; maxBytes: number }> = {
  branding: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
  gallery: { types: [...IMAGE_TYPES, ...VIDEO_TYPES], maxBytes: MAX_DIRECT_UPLOAD_BYTES },
  documents: { types: [...IMAGE_TYPES, ...DOC_TYPES], maxBytes: MAX_DIRECT_UPLOAD_BYTES },
  projects: { types: [...IMAGE_TYPES, ...DOC_TYPES, ...VIDEO_TYPES], maxBytes: MAX_DIRECT_UPLOAD_BYTES },
  companies: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
  equipment: { types: [...IMAGE_TYPES, ...DOC_TYPES, ...VIDEO_TYPES], maxBytes: MAX_DIRECT_UPLOAD_BYTES },
  posts: {
    types: [...IMAGE_TYPES, ...VIDEO_TYPES, ...DOC_TYPES, ...OFFICE_TYPES],
    maxBytes: MAX_DIRECT_UPLOAD_BYTES,
  },
};

const CreateUploadSchema = z.object({
  folder: z.enum(["branding", "gallery", "documents", "projects", "companies", "equipment", "posts"]),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

// Mints a signed upload URL/token instead of receiving file bytes — the
// browser then uploads directly to Supabase Storage with
// `uploadToSignedUrl`, bypassing the app server (and its Cloud Run request
// body limit) entirely.
export const createSiteMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateUploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    const rule = FOLDER_RULES[data.folder];
    if (!rule.types.includes(data.contentType)) {
      throw new Error(`Unsupported file type: ${data.contentType}`);
    }
    if (data.size > rule.maxBytes) {
      throw new Error(`File too large (max ${Math.round(rule.maxBytes / 1024 / 1024)}MB)`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.folder}/${Date.now()}-${safeName}`;

    const { data: signed, error } = await supabaseAdmin.storage.from("site-media").createSignedUploadUrl(path);
    if (error) {
      console.error("createSiteMediaUploadUrl failed", error);
      throw new Error(`Failed to prepare upload: ${error.message}`);
    }

    const { data: pub } = supabaseAdmin.storage.from("site-media").getPublicUrl(path);
    return { path, token: signed.token, contentType: data.contentType, url: pub.publicUrl };
  });

const CONFIDENTIAL_TYPES = [...IMAGE_TYPES, ...DOC_TYPES, ...VIDEO_TYPES];
const CONFIDENTIAL_MAX_BYTES = MAX_DIRECT_UPLOAD_BYTES;

const CreateConfidentialUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

// Confidential files live in a PRIVATE bucket (never publicly readable) and
// are never returned by the public projects query — only accessible here,
// admin-role-gated, and viewed via short-lived signed URLs.
export const createConfidentialUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateConfidentialUploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");

    if (!CONFIDENTIAL_TYPES.includes(data.contentType)) {
      throw new Error(`Unsupported file type: ${data.contentType}`);
    }
    if (data.size > CONFIDENTIAL_MAX_BYTES) {
      throw new Error(`File too large (max ${Math.round(CONFIDENTIAL_MAX_BYTES / 1024 / 1024)}MB)`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `projects/${Date.now()}-${safeName}`;

    const { data: signed, error } = await supabaseAdmin.storage
      .from("confidential-media")
      .createSignedUploadUrl(path);
    if (error) {
      console.error("createConfidentialUploadUrl failed", error);
      throw new Error(`Failed to prepare upload: ${error.message}`);
    }

    return { path, token: signed.token, contentType: data.contentType };
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
