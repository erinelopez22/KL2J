import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dedupeContactsByEmail } from "@/lib/admin/dedupeEmailContacts";
import type { PostType } from "@/lib/postCta";

// Rolling 24h cap on sends across ALL posts combined, and the cadence the
// background worker (see src/routes/api/cron/process-email-queue.ts) is
// invoked at — used to spread same-day overflow into evenly-spaced slots
// starting the next day rather than all landing on one cron tick.
const DAILY_SEND_CAP = 75;
const WORKER_INTERVAL_MS = 60_000;

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
  isExternalLink: z.boolean().optional(),
});

const PostInputSchema = z.object({
  type: z.enum([
    "project",
    "service",
    "profile",
    "update",
    "promotion",
    "testimonial",
    "credentials",
    "team",
    "event",
    "deadline",
    "partnership",
  ]),
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

  if (byEmail.size === 0) return [];

  const { data: suppressedRows, error: suppressedErr } = await supabaseAdmin
    .from("email_suppressions")
    .select("email")
    .in("email", Array.from(byEmail.keys()));
  if (suppressedErr) throw new Error(`Failed to check unsubscribes: ${suppressedErr.message}`);
  for (const row of suppressedRows ?? []) byEmail.delete(row.email);

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

    const { data: row } = await supabaseAdmin
      .from("posts")
      .select("attachments")
      .eq("id", data.id)
      .single();
    if (row?.attachments) {
      const { storagePathFromUrl } = await import("@/lib/storagePathFromUrl");
      const { removeStoragePaths } = await import("@/lib/storageCleanup.server");
      const attachments = row.attachments as unknown as z.infer<typeof PostAttachmentSchema>[];
      const paths = attachments
        .filter((a) => !a.isExternalLink)
        .map((a) => storagePathFromUrl(a.url, "site-media"))
        .filter((p): p is string => !!p);
      await removeStoragePaths("site-media", paths);
    }

    const { error } = await supabaseAdmin.from("posts").delete().eq("id", data.id);
    if (error) {
      console.error("deletePost failed", error);
      throw new Error(`Failed to delete post: ${error.message}`);
    }
    return { ok: true };
  });

// Sending is no longer a synchronous loop in the request handler — it's a
// background cron worker (see src/lib/admin/email-queue-worker.server.ts)
// polling post_recipients for rows whose post has status 'sending'. These
// three functions only ever flip status/scheduling; the actual per-recipient
// send lives exclusively in the worker.

const PostIdInputSchema = z.object({ id: z.string().uuid() });

// Assigns/reassigns scheduled_at for every currently-pending recipient of a
// post against the rolling 24h send cap across ALL posts combined. Whatever
// fits under the cap starting now gets scheduled immediately (picked up by
// the worker in send-order); the rest is spread out starting a day from now,
// one slot per worker interval, instead of being sent (or rejected) all at
// once.
async function scheduleRecipientsForSend(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient,
  postId: string,
): Promise<void> {
  const { data: pendingRows, error: pendingErr } = await supabaseAdmin
    .from("post_recipients")
    .select("id")
    .eq("post_id", postId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (pendingErr) throw new Error(`Failed to load recipients to schedule: ${pendingErr.message}`);
  if (!pendingRows || pendingRows.length === 0) return;

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [{ count: sentRecently }, { count: dueSoonElsewhere }] = await Promise.all([
    supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", since),
    supabaseAdmin
      .from("post_recipients")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "sending"])
      .lt("scheduled_at", nextDay.toISOString())
      .neq("post_id", postId),
  ]);

  const committed = (sentRecently ?? 0) + (dueSoonElsewhere ?? 0);
  const availableToday = Math.max(0, DAILY_SEND_CAP - committed);

  for (let i = 0; i < pendingRows.length; i++) {
    const scheduledAt =
      i < availableToday
        ? now
        : new Date(nextDay.getTime() + (i - availableToday) * WORKER_INTERVAL_MS);
    const { error } = await supabaseAdmin
      .from("post_recipients")
      .update({ scheduled_at: scheduledAt.toISOString() })
      .eq("id", pendingRows[i].id);
    if (error) throw new Error(`Failed to schedule recipient: ${error.message}`);
  }
}

// Moves a draft to 'sending' — its post_recipients rows already exist
// (created at save time) but are inert until now, since the worker only
// picks up rows whose post is actually 'sending'.
export const startPostSending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PostIdInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: post, error: fetchErr } = await supabaseAdmin
      .from("posts")
      .select("status, total_count")
      .eq("id", data.id)
      .single();
    if (fetchErr || !post) throw new Error("Post not found");
    if (post.status !== "draft") {
      throw new Error("This post has already started sending");
    }
    if (post.total_count === 0) throw new Error("This post has no recipients");

    await scheduleRecipientsForSend(supabaseAdmin, data.id);

    const { error: updateErr } = await supabaseAdmin
      .from("posts")
      .update({ status: "sending" })
      .eq("id", data.id);
    if (updateErr) throw new Error(`Failed to start sending: ${updateErr.message}`);

    return { ok: true };
  });

// Un-pauses a batch the circuit breaker stopped: its remaining recipients
// go back to 'pending' and get fresh schedule slots under today's cap.
export const resumePausedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PostIdInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: post, error: fetchErr } = await supabaseAdmin
      .from("posts")
      .select("status")
      .eq("id", data.id)
      .single();
    if (fetchErr || !post) throw new Error("Post not found");
    if (post.status !== "paused") throw new Error("This post isn't paused");

    const { error: recErr } = await supabaseAdmin
      .from("post_recipients")
      .update({ status: "pending" })
      .eq("post_id", data.id)
      .eq("status", "paused");
    if (recErr) throw new Error(`Failed to resume recipients: ${recErr.message}`);

    await scheduleRecipientsForSend(supabaseAdmin, data.id);

    const { error: updateErr } = await supabaseAdmin
      .from("posts")
      .update({ status: "sending" })
      .eq("id", data.id);
    if (updateErr) throw new Error(`Failed to resume sending: ${updateErr.message}`);

    return { ok: true };
  });

// Requeues this post's failed recipients that haven't hit MAX_ATTEMPTS yet.
// Never automatic — only ever admin-triggered from the Recipients modal.
export const retryFailedRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PostIdInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { MAX_ATTEMPTS } = await import("@/lib/admin/email-queue-worker.server");

    const { data: post, error: fetchErr } = await supabaseAdmin
      .from("posts")
      .select("status")
      .eq("id", data.id)
      .single();
    if (fetchErr || !post) throw new Error("Post not found");
    if (post.status !== "sent" && post.status !== "paused") {
      throw new Error("Nothing to retry for this post yet");
    }

    const { data: retryable, error: retryErr } = await supabaseAdmin
      .from("post_recipients")
      .select("id")
      .eq("post_id", data.id)
      .eq("status", "failed")
      .lt("attempts", MAX_ATTEMPTS);
    if (retryErr) throw new Error(`Failed to load failed recipients: ${retryErr.message}`);
    if (!retryable || retryable.length === 0) {
      throw new Error("No failed recipients are eligible for retry (max attempts reached)");
    }

    const { error: updateErr } = await supabaseAdmin
      .from("post_recipients")
      .update({ status: "pending", error: null })
      .in(
        "id",
        retryable.map((r) => r.id),
      );
    if (updateErr) throw new Error(`Failed to reset recipients for retry: ${updateErr.message}`);

    await scheduleRecipientsForSend(supabaseAdmin, data.id);

    const { error: postUpdateErr } = await supabaseAdmin
      .from("posts")
      .update({ status: "sending" })
      .eq("id", data.id);
    if (postUpdateErr) throw new Error(`Failed to resume sending: ${postUpdateErr.message}`);

    return { retried: retryable.length };
  });

const PreviewPostEmailSchema = z.object({
  type: z.enum([
    "project",
    "service",
    "profile",
    "update",
    "promotion",
    "testimonial",
    "credentials",
    "team",
    "event",
    "deadline",
    "partnership",
  ]),
});

// Renders a sample email using the currently-saved email cover photo
// settings (default + per-type override), so an admin can check how a
// cover photo will actually look before sending a real post — no post row
// involved, just canned sample copy for the given type.
export const previewPostEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PreviewPostEmailSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildPostEmailHtml, POST_TYPE_META } = await import("@/lib/posts-mailer.server");

    const { data: siteSettings } = await supabaseAdmin
      .from("site_settings")
      .select("email_cover_photo_url, email_cover_photo_by_type, logo_url")
      .eq("id", 1)
      .single();

    const coverPhotoByType =
      (siteSettings?.email_cover_photo_by_type as Record<string, string>) ?? {};
    const meta = POST_TYPE_META[data.type as PostType];
    const html = buildPostEmailHtml({
      type: data.type as PostType,
      title: `Sample ${meta.label.toLowerCase()}`,
      subject: "Preview",
      body_html:
        "<p>This is sample text so you can see how the cover photo looks in an actual email. Your real post's title and content will appear here instead.</p>",
      project_ids: [],
      attachments: [],
      coverPhotoUrl: coverPhotoByType[data.type] ?? siteSettings?.email_cover_photo_url ?? null,
      logoUrl: siteSettings?.logo_url ?? null,
    });

    return { html };
  });

// One-time/on-demand catch-up for recipients whose message was sent before
// the Brevo webhook existed (or during a window it was misconfigured) —
// see src/lib/admin/email-delivery-backfill.server.ts for why this can't
// just be "wait for a retry."
export const backfillDeliveryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { backfillDeliveryStatuses } = await import("@/lib/admin/email-delivery-backfill.server");
    return backfillDeliveryStatuses();
  });

// Brevo's own remaining send quota — separate from our internal
// DAILY_SEND_CAP above, which paces OUR sending; this is what Brevo itself
// will still accept before it starts rejecting sends outright.
export const getEmailUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { getBrevoEmailUsage } = await import("@/lib/admin/brevo-account.server");
    return getBrevoEmailUsage();
  });

export const listSuppressedEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertRole } = await import("@/lib/admin/roles.server");
    await assertRole(context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("email_suppressions")
      .select("id, email, unsubscribed_at")
      .order("unsubscribed_at", { ascending: false });
    if (error) throw new Error(`Failed to load unsubscribes: ${error.message}`);

    return data ?? [];
  });
