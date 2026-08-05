import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = ["application/pdf"];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOC_TYPES];
const MAX_BYTES = 10 * 1024 * 1024;

const UploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1),
  base64: z.string().min(1),
});

// Public, unauthenticated upload for optional supporting documents an
// inquirer attaches via the quote form or chatbot (land title, tax
// declaration, etc.). These can be sensitive, so — same as admin
// confidential project files — they go into the PRIVATE "confidential-media"
// bucket, never the public site-media one, and are only ever readable by
// admins via short-lived signed URLs (see getConfidentialFileUrl).
export const uploadInquiryDocument = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UploadSchema.parse(data))
  .handler(async ({ data }) => {
    if (!ALLOWED_TYPES.includes(data.contentType)) {
      throw new Error(`Unsupported file type: ${data.contentType}`);
    }
    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error(`File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `inquiries/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const { error } = await supabaseAdmin.storage
      .from("confidential-media")
      .upload(path, buffer, { contentType: data.contentType, upsert: false });
    if (error) {
      console.error("uploadInquiryDocument failed", error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    return { path, contentType: data.contentType };
  });
