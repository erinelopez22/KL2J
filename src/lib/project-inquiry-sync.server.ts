// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).

type InquiryAttachment = {
  path: string;
  name: string;
  contentType: string;
  isExternalLink?: boolean;
};
type ConfidentialAttachment = {
  path: string;
  type: "image" | "video" | "document";
  name: string;
  isExternalLink?: boolean;
};

function attachmentTypeFor(contentType: string): ConfidentialAttachment["type"] {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

// Copies an inquiry's consolidated attachments (checklist documents + every
// comment attachment from either side, see src/lib/inquiry-comments.server.ts)
// onto its linked project's CONFIDENTIAL attachments — never the public ones
// — so customer-submitted files never appear in the public gallery without
// an admin explicitly promoting them first. Dedupes by storage path, so it's
// safe to call repeatedly (on every project save, and every time the inquiry
// gets a new attachment).
export async function syncInquiryAttachmentsToProject(
  projectId: string,
  inquiryId: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: inquiry, error: inquiryErr }, { data: project, error: projectErr }] =
    await Promise.all([
      supabaseAdmin.from("inquiries").select("attachments").eq("id", inquiryId).single(),
      supabaseAdmin
        .from("projects")
        .select("confidential_attachments")
        .eq("id", projectId)
        .single(),
    ]);
  if (inquiryErr || projectErr) {
    console.error("syncInquiryAttachmentsToProject fetch failed", inquiryErr ?? projectErr);
    return;
  }

  const inquiryAttachments = (inquiry?.attachments as unknown as InquiryAttachment[]) ?? [];
  if (inquiryAttachments.length === 0) return;

  const current = (project?.confidential_attachments as unknown as ConfidentialAttachment[]) ?? [];
  const currentPaths = new Set(current.map((a) => a.path));
  const toAdd: ConfidentialAttachment[] = inquiryAttachments
    .filter((a) => !currentPaths.has(a.path))
    .map((a) => ({
      path: a.path,
      name: a.name,
      type: attachmentTypeFor(a.contentType),
      isExternalLink: a.isExternalLink,
    }));
  if (toAdd.length === 0) return;

  const { error: updateErr } = await supabaseAdmin
    .from("projects")
    .update({ confidential_attachments: [...current, ...toAdd] })
    .eq("id", projectId);
  if (updateErr) {
    console.error("syncInquiryAttachmentsToProject update failed", updateErr);
  }
}

// Looks up whether an inquiry has a linked project and, if so, syncs its
// attachments onto it. Safe to call on every inquiry attachment append —
// it's a no-op when there's no linked project.
export async function syncInquiryToLinkedProject(inquiryId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("inquiry_id", inquiryId)
    .maybeSingle();
  if (error || !project) return;
  await syncInquiryAttachmentsToProject(project.id, inquiryId);
}
