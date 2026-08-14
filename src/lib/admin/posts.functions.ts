import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dedupeContactsByEmail } from "@/lib/admin/dedupeEmailContacts";

const BATCH_SIZE_DEFAULT = 40;
const SEND_DELAY_MS = 250;

const RecipientSelectionSchema = z.object({
  mode: z.enum(["none", "all", "selected"]),
  inquiryIds: z.array(z.string().uuid()).default([]),
  customEmails: z.array(z.string().email()).default([]),
});

const PostAttachmentSchema = z.object({
  url: z.string().min(1),
  name: z.string().min(1),
  contentType: z.string().min(1),
  kind: z.enum(["image", "video", "document"]),
});

const PostInputSchema = z.object({
  type: z.enum(["project", "service", "profile", "update"]),
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  projectIds: z.array(z.string().uuid()).default([]),
  attachments: z.array(PostAttachmentSchema).default([]),
  recipients: RecipientSelectionSchema,
});

type ResolvedRecipient = {
  email: string;
  name: string | null;
  source: "inquiry" | "custom";
  inquiry_id: string | null;
  created_at: string;
};

async function resolveRecipients(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient,
  recipients: z.infer<typeof RecipientSelectionSchema>,
): Promise<ResolvedRecipient[]> {
  let inquiryContacts: { id: string; name: string; email: string | null; created_at: string }[] =
    [];

  if (recipients.mode === "all") {
    const { data, error } = await supabaseAdmin
      .from("inquiries")
      .select("id, name, email, created_at")
      .not("email", "is", null);
    if (error) throw new Error(`Failed to load recipients: ${error.message}`);
    inquiryContacts = data ?? [];
  } else if (recipients.mode === "selected" && recipients.inquiryIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("inquiries")
      .select("id, name, email, created_at")
      .in("id", recipients.inquiryIds)
      .not("email", "is", null);
    if (error) throw new Error(`Failed to load recipients: ${error.message}`);
    inquiryContacts = data ?? [];
  }

  const dedupedInquiryContacts = dedupeContactsByEmail(inquiryContacts);

  const byEmail = new Map<string, ResolvedRecipient>();
  for (const c of dedupedInquiryContacts) {
    if (!c.email) continue;
    byEmail.set(c.email.trim().toLowerCase(), {
      email: c.email.trim(),
      name: c.name,
      source: "inquiry",
      inquiry_id: c.id,
      created_at: c.created_at,
    });
  }
  for (const email of recipients.customEmails) {
    const key = email.trim().toLowerCase();
    if (byEmail.has(key)) continue; // already covered by an inquiry contact
    byEmail.set(key, {
      email: email.trim(),
      name: null,
      source: "custom",
      inquiry_id: null,
      created_at: new Date().toISOString(),
    });
  }

  return Array.from(byEmail.values());
}

export const createPostDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PostInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { sanitizePostHtml } = await import("@/lib/admin/posts-sanitize.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bodyHtml = sanitizePostHtml(data.bodyHtml);
    const resolved = await resolveRecipients(supabaseAdmin, data.recipients);

    const { data: post, error: insertErr } = await supabaseAdmin
      .from("posts")
      .insert({
        type: data.type,
        title: data.title,
        subject: data.subject,
        body_html: bodyHtml,
        project_ids: data.projectIds,
        attachments: data.attachments,
        recipient_mode: data.recipients.mode,
        created_by: context.userId,
        total_count: resolved.length,
      })
      .select("id")
      .single();
    if (insertErr || !post) {
      console.error("createPostDraft insert failed", insertErr);
      throw new Error("Failed to create post");
    }

    if (resolved.length > 0) {
      const { error: recipientsErr } = await supabaseAdmin.from("post_recipients").insert(
        resolved.map((r) => ({
          post_id: post.id,
          inquiry_id: r.inquiry_id,
          email: r.email,
          name: r.name,
          source: r.source,
        })),
      );
      if (recipientsErr) {
        console.error("createPostDraft recipients insert failed", recipientsErr);
        throw new Error("Failed to save recipients");
      }
    }

    return { id: post.id as string };
  });

const UpdatePostInputSchema = PostInputSchema.extend({ id: z.string().uuid() });

export const updatePostDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdatePostInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { sanitizePostHtml } = await import("@/lib/admin/posts-sanitize.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("posts")
      .select("status")
      .eq("id", data.id)
      .single();
    if (fetchErr || !existing) throw new Error("Post not found");
    if (existing.status !== "draft") {
      throw new Error("Cannot edit a post that has already started sending");
    }

    const bodyHtml = sanitizePostHtml(data.bodyHtml);
    const resolved = await resolveRecipients(supabaseAdmin, data.recipients);

    const { error: updateErr } = await supabaseAdmin
      .from("posts")
      .update({
        type: data.type,
        title: data.title,
        subject: data.subject,
        body_html: bodyHtml,
        project_ids: data.projectIds,
        attachments: data.attachments,
        recipient_mode: data.recipients.mode,
        total_count: resolved.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateErr) {
      console.error("updatePostDraft update failed", updateErr);
      throw new Error("Failed to update post");
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("post_recipients")
      .delete()
      .eq("post_id", data.id);
    if (deleteErr) {
      console.error("updatePostDraft recipient reset failed", deleteErr);
      throw new Error("Failed to update recipients");
    }
    if (resolved.length > 0) {
      const { error: recipientsErr } = await supabaseAdmin.from("post_recipients").insert(
        resolved.map((r) => ({
          post_id: data.id,
          inquiry_id: r.inquiry_id,
          email: r.email,
          name: r.name,
          source: r.source,
        })),
      );
      if (recipientsErr) {
        console.error("updatePostDraft recipients insert failed", recipientsErr);
        throw new Error("Failed to save recipients");
      }
    }

    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("posts").delete().eq("id", data.id);
    if (error) {
      console.error("deletePost failed", error);
      throw new Error(`Failed to delete post: ${error.message}`);
    }
    return { ok: true };
  });

const SendBatchInputSchema = z.object({
  id: z.string().uuid(),
  batchSize: z.number().int().min(1).max(200).optional(),
  retryFailed: z.boolean().optional(),
});

export const sendPostBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SendBatchInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPostToRecipient, sleep } = await import("@/lib/posts-mailer.server");

    const { data: post, error: postErr } = await supabaseAdmin
      .from("posts")
      .select("id, type, title, subject, body_html, status, project_ids, attachments")
      .eq("id", data.id)
      .single();
    if (postErr || !post) throw new Error("Post not found");

    if (post.status === "draft") {
      await supabaseAdmin.from("posts").update({ status: "sending" }).eq("id", data.id);
    }

    if (data.retryFailed) {
      await supabaseAdmin
        .from("post_recipients")
        .update({ status: "pending", error: null })
        .eq("post_id", data.id)
        .eq("status", "failed");
    }

    const batchSize = data.batchSize ?? BATCH_SIZE_DEFAULT;
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("post_recipients")
      .select("id, email, name")
      .eq("post_id", data.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (batchErr) throw new Error(`Failed to load recipients: ${batchErr.message}`);

    let sentThisBatch = 0;
    let failedThisBatch = 0;
    const postForEmail = {
      type: post.type as "project" | "service" | "profile" | "update",
      title: post.title,
      subject: post.subject,
      body_html: post.body_html,
      project_ids: post.project_ids,
      attachments: post.attachments as {
        url: string;
        name: string;
        contentType: string;
        kind: "image" | "video" | "document";
      }[],
    };

    for (let i = 0; i < (batch ?? []).length; i++) {
      const recipient = batch![i];
      try {
        await sendPostToRecipient(postForEmail, recipient);
        await supabaseAdmin
          .from("post_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", recipient.id);
        sentThisBatch++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`sendPostBatch: send failed for ${recipient.email}`, message);
        await supabaseAdmin
          .from("post_recipients")
          .update({ status: "failed", error: message })
          .eq("id", recipient.id);
        failedThisBatch++;
      }
      if (i < (batch ?? []).length - 1) await sleep(SEND_DELAY_MS);
    }

    const { count: sentCount } = await supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .eq("post_id", data.id)
      .eq("status", "sent");
    const { count: failedCount } = await supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .eq("post_id", data.id)
      .eq("status", "failed");
    const { count: pendingCount } = await supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .eq("post_id", data.id)
      .eq("status", "pending");

    const remainingPending = pendingCount ?? 0;
    const remainingFailed = failedCount ?? 0;
    const done = remainingPending === 0;

    await supabaseAdmin
      .from("posts")
      .update({
        sent_count: sentCount ?? 0,
        failed_count: remainingFailed,
        ...(done ? { status: "sent", sent_at: new Date().toISOString() } : {}),
      })
      .eq("id", data.id);

    return { sentThisBatch, failedThisBatch, remainingPending, remainingFailed, done };
  });
