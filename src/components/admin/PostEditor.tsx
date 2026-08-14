import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import {
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Loader2,
  Check,
  Square,
  CheckSquare,
  Video,
  Clapperboard,
  Paperclip,
  FileText,
  ExternalLink,
  Smile,
  Palette,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createPostDraft, updatePostDraft } from "@/lib/admin/posts.functions";
import { uploadSiteMedia } from "@/lib/admin/media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";
import { dedupeContactsByEmail } from "@/lib/admin/dedupeEmailContacts";
import { ctaForPost } from "@/lib/postCta";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import logoUrl from "@/assets/kl2j-logo.jpg";

export type PostType = "project" | "service" | "profile" | "update";
export type PostAttachment = {
  url: string;
  name: string;
  contentType: string;
  kind: "image" | "video" | "document";
};

export type PostRecord = {
  id: string;
  type: PostType;
  title: string;
  subject: string;
  body_html: string;
  project_ids: string[];
  attachments: PostAttachment[];
  recipient_mode: RecipientMode;
};

// Kept in sync by eye with POST_TYPE_META's accentColor in posts-mailer.server.ts
// (that file is server-only and can't be imported from a client component).
const TYPE_OPTIONS: { value: PostType; label: string; emoji: string; color: string }[] = [
  { value: "project", label: "New project accomplished", emoji: "🏗️", color: "#8b1e1e" },
  { value: "service", label: "New / updated service", emoji: "🛠️", color: "#1e5f8b" },
  { value: "profile", label: "Company update", emoji: "🏢", color: "#8b6f1e" },
  { value: "update", label: "General update", emoji: "📢", color: "#3a3a3a" },
];

type InquiryContact = { id: string; name: string; email: string | null; created_at: string };
type RecipientMode = "none" | "all" | "selected";

// Email-safe font stacks only — custom web fonts aren't reliably supported
// by email clients, so the toolbar deliberately only offers system fonts.
const FONT_FAMILIES = [
  { label: "Default font", value: "" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
];

const FONT_SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "" },
  { label: "Large", value: "20px" },
  { label: "Huge", value: "28px" },
];

const COLOR_SWATCHES = ["#111111", "#8b1e1e", "#1e5f8b", "#1e8b4f", "#8b6f1e", "#6b1e8b"];

const EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😎",
  "🤔",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🙏",
  "💪",
  "✅",
  "❌",
  "🎉",
  "🎊",
  "🚀",
  "⭐",
  "🔥",
  "💯",
  "❤️",
  "💡",
  "📢",
  "📌",
  "📷",
  "🎥",
  "📄",
  "🏠",
  "🏗️",
  "🛠️",
  "📍",
  "📅",
  "🕒",
  "✨",
  "👋",
  "🤝",
  "🙋",
  "🧭",
  "📈",
  "🏆",
  "🎯",
  "🔔",
  "💬",
  "📝",
  "✔️",
  "➡️",
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm disabled:opacity-40 ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#111111");
  const [emojiOpen, setEmojiOpen] = useState(false);

  if (!editor) return null;

  function openLinkPopover() {
    setLinkUrl(editor!.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function applyLink() {
    if (!linkUrl.trim()) {
      editor!.chain().focus().unsetLink().run();
    } else {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setLinkOpen(false);
  }

  function applyColor(hex: string) {
    editor!.chain().focus().setColor(hex).run();
    setColorOpen(false);
  }

  function insertEmoji(emoji: string) {
    editor!.chain().focus().insertContent(emoji).run();
    setEmojiOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-border bg-muted/20 p-1">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <select
        onChange={(e) => {
          if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        defaultValue=""
        aria-label="Font family"
        className="h-8 rounded-md border-0 bg-transparent px-1 text-xs text-muted-foreground hover:bg-muted focus:outline-none"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        onChange={(e) => {
          if (e.target.value) editor.chain().focus().setFontSize(e.target.value).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
        defaultValue=""
        aria-label="Font size"
        className="h-8 rounded-md border-0 bg-transparent px-1 text-xs text-muted-foreground hover:bg-muted focus:outline-none"
      >
        {FONT_SIZES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger asChild>
          <span>
            <ToolbarButton onClick={() => setColorOpen(true)} label="Text color">
              <Palette className="h-4 w-4" />
            </ToolbarButton>
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-56" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-6 gap-1.5">
            {COLOR_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => applyColor(hex)}
                className="h-7 w-7 rounded-full border border-border"
                style={{ backgroundColor: hex }}
                aria-label={hex}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-border p-0"
              aria-label="Custom color"
            />
            <button
              type="button"
              onClick={() => applyColor(customColor)}
              className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Apply
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <span>
            <ToolbarButton
              onClick={openLinkPopover}
              active={editor.isActive("link")}
              label="Insert link"
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLink();
              }}
              placeholder="https://…"
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
            <button
              type="button"
              onClick={applyLink}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
              aria-label="Apply link"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <span>
            <ToolbarButton onClick={() => setEmojiOpen(true)} label="Insert emoji">
              <Smile className="h-4 w-4" />
            </ToolbarButton>
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-8 gap-1 text-lg">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="rounded hover:bg-muted"
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RecipientPicker({
  contacts,
  contactsLoading,
  mode,
  onModeChange,
  selectedIds,
  onToggleContact,
  customEmails,
  onAddCustom,
  onRemoveCustom,
}: {
  contacts: InquiryContact[];
  contactsLoading: boolean;
  mode: RecipientMode;
  onModeChange: (m: RecipientMode) => void;
  selectedIds: Set<string>;
  onToggleContact: (id: string) => void;
  customEmails: string[];
  onAddCustom: (email: string) => void;
  onRemoveCustom: (email: string) => void;
}) {
  const [customInput, setCustomInput] = useState("");

  const deduped = useMemo(() => dedupeContactsByEmail(contacts), [contacts]);
  const contactEmailSet = useMemo(
    () => new Set(deduped.filter((c) => c.email).map((c) => c.email!.trim().toLowerCase())),
    [deduped],
  );
  const uniqueCustomEmails = useMemo(
    () => customEmails.filter((e) => !contactEmailSet.has(e.trim().toLowerCase())),
    [customEmails, contactEmailSet],
  );
  const fromRecordsCount =
    mode === "all" ? deduped.length : mode === "selected" ? selectedIds.size : 0;
  const totalCount = fromRecordsCount + uniqueCustomEmails.length;

  function addCustomFromInput() {
    const email = customInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    onAddCustom(email);
    setCustomInput("");
  }

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3">
      <p className="mb-2 text-sm font-semibold">Who's this going to?</p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "none", label: "None selected" },
            { value: "all", label: "All customers with an email" },
            { value: "selected", label: "Choose specific" },
          ] as { value: RecipientMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onModeChange(opt.value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === opt.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "selected" && (
        <div className="mt-2 rounded-md border border-border bg-background">
          <Command shouldFilter={true}>
            <CommandInput placeholder="Search customers by name or email…" />
            <CommandList>
              {contactsLoading && (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
              )}
              <CommandEmpty>No customers found.</CommandEmpty>
              {deduped.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.email}`}
                  onSelect={() => onToggleContact(c.id)}
                  className="cursor-pointer"
                >
                  {selectedIds.has(c.id) ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
                    {c.email}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      )}

      <div className="mt-3">
        <span className="mb-1 block text-xs text-muted-foreground">Or add someone by email</span>
        <div className="flex gap-2">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomFromInput();
              }
            }}
            placeholder="name@example.com"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
          <button
            type="button"
            onClick={addCustomFromInput}
            className="shrink-0 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            Add
          </button>
        </div>
        {customEmails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {customEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {email}
                <button
                  type="button"
                  onClick={() => onRemoveCustom(email)}
                  aria-label={`Remove ${email}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-sm font-medium">
        {totalCount} recipient{totalCount === 1 ? "" : "s"} selected
        {totalCount > 0 && (
          <span className="font-normal text-muted-foreground">
            {" "}
            ({fromRecordsCount} from customer records, {uniqueCustomEmails.length} custom)
          </span>
        )}
      </p>
    </div>
  );
}

function AttachmentTile({ a, onRemove }: { a: PostAttachment; onRemove: () => void }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      {a.kind === "image" ? (
        <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          {a.kind === "video" ? (
            <Video className="h-6 w-6 text-muted-foreground" />
          ) : (
            <FileText className="h-6 w-6 text-muted-foreground" />
          )}
          <span className="line-clamp-2 text-[10px] text-muted-foreground">{a.name}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${a.name}`}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PostEditor({
  post,
  onClose,
  onSaved,
}: {
  post?: PostRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<PostType>(post?.type ?? "update");
  const [title, setTitle] = useState(post?.title ?? "");
  const [projectIds, setProjectIds] = useState<string[]>(post?.project_ids ?? []);
  const [attachments, setAttachments] = useState<PostAttachment[]>(post?.attachments ?? []);
  const [mode, setMode] = useState<RecipientMode>(post?.recipient_mode ?? "none");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const recipientsInitialized = useRef(false);
  const photoVideoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cta = useMemo(() => ctaForPost(type, projectIds), [type, projectIds]);
  const activeType = TYPE_OPTIONS.find((t) => t.value === type)!;

  const doCreate = useServerFn(createPostDraft);
  const doUpdate = useServerFn(updatePostDraft);

  const { data: existingRecipients } = useQuery({
    queryKey: ["admin-post-recipients", post?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_recipients")
        .select("email, name, source, inquiry_id")
        .eq("post_id", post!.id);
      if (error) throw error;
      return data as {
        email: string;
        name: string | null;
        source: string;
        inquiry_id: string | null;
      }[];
    },
    enabled: !!post,
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["admin-inquiry-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select("id, name, email, created_at")
        .not("email", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InquiryContact[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["admin-projects-for-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .order("sort_order", { ascending: false });
      if (error) throw error;
      return data as { id: string; title: string }[];
    },
    enabled: type === "project",
  });

  // Reconstruct the previously-saved recipient selection when editing a
  // draft — post_recipients has no notion of "mode", only resolved rows, so
  // inquiry-sourced rows are matched back to today's deduped contact list by
  // email (not by the original inquiry_id, which dedup may no longer treat
  // as the representative row for that email).
  useEffect(() => {
    if (!post || recipientsInitialized.current) return;
    if (!existingRecipients || !contacts) return;
    const deduped = dedupeContactsByEmail(contacts);
    const emailToContactId = new Map(
      deduped.filter((c) => c.email).map((c) => [c.email!.trim().toLowerCase(), c.id]),
    );
    const nextSelected = new Set<string>();
    const nextCustom: string[] = [];
    for (const r of existingRecipients) {
      if (r.source === "inquiry") {
        const contactId = emailToContactId.get(r.email.trim().toLowerCase());
        if (contactId) nextSelected.add(contactId);
      } else {
        nextCustom.push(r.email);
      }
    }
    setSelectedIds(nextSelected);
    setCustomEmails(nextCustom);
    recipientsInitialized.current = true;
  }, [post, existingRecipients, contacts]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Placeholder.configure({ placeholder: "What's on your mind?" }),
    ],
    content: post?.body_html ?? "",
    editorProps: {
      attributes: {
        class:
          "min-h-[140px] rounded-b-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none " +
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
          "[&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold " +
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground " +
          "[&_p]:my-1",
      },
    },
  });

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCustomEmail(email: string) {
    setCustomEmails((prev) =>
      prev.some((e) => e.toLowerCase() === email.toLowerCase()) ? prev : [...prev, email],
    );
  }

  function removeCustomEmail(email: string) {
    setCustomEmails((prev) => prev.filter((e) => e !== email));
  }

  async function handleAddAttachments(files: FileList) {
    setUploadingAttachments(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const result = await uploadSiteMedia({
          data: { folder: "posts", filename: file.name, contentType: file.type, base64 },
        });
        const kind: PostAttachment["kind"] = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : "document";
        setAttachments((prev) => [
          ...prev,
          { url: result.url, name: file.name, contentType: result.contentType, kind },
        ]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attachment upload failed");
    } finally {
      setUploadingAttachments(false);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Give this post a title");
      return;
    }
    if (!editor || editor.isEmpty) {
      toast.error("Write something before posting");
      return;
    }
    setSaving(true);
    try {
      const input = {
        type,
        title: title.trim(),
        subject: title.trim(),
        bodyHtml: editor.getHTML(),
        projectIds: type === "project" ? projectIds : [],
        attachments,
        recipients: {
          mode,
          inquiryIds: mode === "selected" ? Array.from(selectedIds) : [],
          customEmails,
        },
      };
      if (post) {
        await doUpdate({ data: { id: post.id, ...input } });
        toast.success("Post updated");
      } else {
        await doCreate({ data: input });
        toast.success("Draft saved");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  const gridCols =
    attachments.length === 1
      ? "grid-cols-1"
      : attachments.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{post ? "Edit post" : "Create post"}</h2>
          <button
            onClick={onClose}
            className="absolute right-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="KL2J"
              className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">KL2J Land Surveying</p>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PostType)}
                className="mt-0.5 h-6 rounded-full border-0 px-2 text-xs font-medium focus:outline-none"
                style={{ backgroundColor: `${activeType.color}1a`, color: activeType.color }}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.emoji} {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="w-full border-0 bg-transparent text-lg font-semibold placeholder:text-muted-foreground/60 focus:outline-none"
          />

          {type === "project" && (
            <div className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Related project(s) (optional)
              </span>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {(projects ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                )}
                {(projects ?? []).map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) =>
                        setProjectIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                        )
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    {p.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>

          {attachments.length > 0 && (
            <div className={`grid gap-1.5 ${gridCols}`}>
              {attachments.map((a, i) => (
                <AttachmentTile key={a.url} a={a} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 rounded-xl border border-border p-2">
            <span className="px-1 text-sm font-medium text-muted-foreground">Add to your post</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => photoVideoInputRef.current?.click()}
                disabled={uploadingAttachments}
                aria-label="Add photo or video"
                title="Photo/video"
                className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
              >
                {uploadingAttachments ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Clapperboard className="h-4.5 w-4.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachments}
                aria-label="Add a file"
                title="File"
                className="flex h-9 w-9 items-center justify-center rounded-full text-sky-600 hover:bg-sky-50 disabled:opacity-60"
              >
                <Paperclip className="h-4.5 w-4.5" />
              </button>
            </div>
            <input
              ref={photoVideoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0)
                  handleAddAttachments(e.target.files);
                if (photoVideoInputRef.current) photoVideoInputRef.current.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0)
                  handleAddAttachments(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>

          <a
            href={cta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm hover:bg-muted/50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ExternalLink className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{cta.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                Automatically added to this post's email — kl2j-...hosted.app
              </span>
            </span>
          </a>

          <RecipientPicker
            contacts={contacts ?? []}
            contactsLoading={contactsLoading}
            mode={mode}
            onModeChange={setMode}
            selectedIds={selectedIds}
            onToggleContact={toggleContact}
            customEmails={customEmails}
            onAddCustom={addCustomEmail}
            onRemoveCustom={removeCustomEmail}
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
