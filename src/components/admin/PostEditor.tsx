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
  Send,
  Users,
  Plus,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createPostDraft, updatePostDraft } from "@/lib/admin/posts.functions";
import { SendProgress, type SendablePost } from "@/components/admin/SendProgress";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { uploadSiteMedia, deleteSiteMedia } from "@/lib/admin/media.functions";
import { fileToBase64 } from "@/lib/admin/fileToBase64";
import { storagePathFromUrl } from "@/lib/storagePathFromUrl";
import { dedupeContactsByEmail } from "@/lib/admin/dedupeEmailContacts";
import { ctaForPost, type PostType } from "@/lib/postCta";
import { compressImage } from "@/lib/compressImage";
import { isOversizedFile } from "@/lib/uploadLimits";
import { OversizeFileLinkPrompt } from "@/components/OversizeFileLinkPrompt";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import logoUrl from "@/assets/kl2j-logo.jpg";

export type { PostType };
export type PostAttachment = {
  url: string;
  name: string;
  contentType: string;
  kind: "image" | "video" | "document";
  isExternalLink?: boolean;
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
  { value: "promotion", label: "Promotion / special offer", emoji: "🏷️", color: "#c2410c" },
  { value: "testimonial", label: "Client testimonial highlight", emoji: "⭐", color: "#b45309" },
  {
    value: "credentials",
    label: "Credentials / certification update",
    emoji: "🎓",
    color: "#0f766e",
  },
  { value: "team", label: "Team / personnel announcement", emoji: "👥", color: "#4338ca" },
  { value: "event", label: "Event / seminar", emoji: "📅", color: "#7c3aed" },
  { value: "deadline", label: "Deadline / compliance reminder", emoji: "⏰", color: "#b91c1c" },
  { value: "partnership", label: "Partnership announcement", emoji: "🤝", color: "#0e7490" },
];

type InquiryContact = { id: string; name: string; email: string | null; created_at: string };
type EmailListContact = { id: string; email: string; name: string | null; created_at: string };
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

/** Emails of customer records actually included by the current recipient mode
 * — used to tell whether a custom email is a true duplicate (vs. just matching
 * some unrelated contact that isn't part of the selection). */
function includedContactEmails(
  mode: RecipientMode,
  deduped: InquiryContact[],
  selectedIds: Set<string>,
): Set<string> {
  if (mode === "all") {
    return new Set(deduped.filter((c) => c.email).map((c) => c.email!.trim().toLowerCase()));
  }
  if (mode === "selected") {
    return new Set(
      deduped
        .filter((c) => c.email && selectedIds.has(c.id))
        .map((c) => c.email!.trim().toLowerCase()),
    );
  }
  return new Set();
}

function RecipientPicker({
  contacts,
  contactsLoading,
  emailContacts,
  emailContactsLoading,
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
  emailContacts: EmailListContact[];
  emailContactsLoading: boolean;
  mode: RecipientMode;
  onModeChange: (m: RecipientMode) => void;
  selectedIds: Set<string>;
  onToggleContact: (id: string) => void;
  customEmails: string[];
  onAddCustom: (email: string) => void;
  onRemoveCustom: (email: string) => void;
}) {
  const [customInput, setCustomInput] = useState("");
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  const deduped = useMemo(() => dedupeContactsByEmail(contacts), [contacts]);
  const includedEmails = useMemo(
    () => includedContactEmails(mode, deduped, selectedIds),
    [mode, deduped, selectedIds],
  );
  const uniqueCustomEmails = useMemo(
    () => customEmails.filter((e) => !includedEmails.has(e.trim().toLowerCase())),
    [customEmails, includedEmails],
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

  function addBulkFromInput() {
    const candidates = bulkInput
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (candidates.length === 0) return;
    const seen = new Set<string>();
    let added = 0;
    let invalid = 0;
    for (const email of candidates) {
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalid++;
        continue;
      }
      onAddCustom(email);
      added++;
    }
    setBulkInput("");
    if (added > 0) toast.success(`Added ${added} recipient${added === 1 ? "" : "s"}`);
    if (invalid > 0) toast.error(`Skipped ${invalid} invalid email${invalid === 1 ? "" : "es"}`);
  }

  return (
    <div>
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
            onDoubleClick={() => {
              if (opt.value === "all") setShowAllPreview((v) => !v);
            }}
            title={opt.value === "all" ? "Double-click to see who's included" : undefined}
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

      {mode === "all" && showAllPreview && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2">
          {deduped.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No customers with an email yet.</p>
          ) : (
            deduped.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
                  {c.email}
                </span>
              </div>
            ))
          )}
        </div>
      )}

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
        <button
          type="button"
          onClick={() => setShowBulkAdd((v) => !v)}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {showBulkAdd ? "Hide bulk add" : "Bulk add multiple emails"}
        </button>
        {showBulkAdd && (
          <div className="mt-1.5">
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={3}
              placeholder={"Paste multiple emails — separated by commas, semicolons, or one per line"}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addBulkFromInput}
              className="mt-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Add all
            </button>
          </div>
        )}
      </div>

      {emailContacts.length > 0 && (
        <div className="mt-3">
          <span className="mb-1 block text-xs text-muted-foreground">Or pick from your email list</span>
          <div className="rounded-md border border-border bg-background">
            <Command shouldFilter={true}>
              <CommandInput placeholder="Search your email list…" />
              <CommandList>
                {emailContactsLoading && (
                  <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
                )}
                <CommandEmpty>No contacts found.</CommandEmpty>
                {emailContacts.map((c) => {
                  const checked = customEmails.some(
                    (e) => e.trim().toLowerCase() === c.email.trim().toLowerCase(),
                  );
                  return (
                    <CommandItem
                      key={c.id}
                      value={`${c.name ?? ""} ${c.email}`}
                      onSelect={() => (checked ? onRemoveCustom(c.email) : onAddCustom(c.email))}
                      className="cursor-pointer"
                    >
                      {checked ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{c.name || c.email}</span>
                      {c.name && (
                        <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
                          {c.email}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </div>
        </div>
      )}

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

export function AttachmentTile({ a, onRemove }: { a: PostAttachment; onRemove?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  // Composing (onRemove present) defaults to a small icon with an expand
  // toggle; the read-only sent-post viewer keeps its original grid-filling size.
  const editable = !!onRemove;
  const sizeClass = editable ? (expanded ? "h-40 w-40" : "h-16 w-16") : "aspect-square";
  const canPreview = a.kind === "image" || a.kind === "video";

  const inner = (
    <>
      {a.kind === "image" ? (
        <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
      ) : a.kind === "video" && editable && expanded ? (
        <video src={a.url} controls className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          {a.kind === "video" ? (
            <Video className="h-6 w-6 text-muted-foreground" />
          ) : (
            <FileText className="h-6 w-6 text-muted-foreground" />
          )}
          {(!editable || expanded) && (
            <span className="line-clamp-2 text-[10px] text-muted-foreground">{a.name}</span>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      className={`group relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted ${sizeClass}`}
    >
      {onRemove ? (
        inner
      ) : (
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full w-full"
          title={`Open ${a.name}`}
        >
          {inner}
        </a>
      )}
      {editable && canPreview && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? `Shrink ${a.name}` : `Preview ${a.name}`}
          title={expanded ? "Shrink" : "Preview"}
          className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
        >
          {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${a.name}`}
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function PostEditor({
  post,
  duplicateFrom,
  onClose,
  onSaved,
}: {
  post?: PostRecord;
  // Pre-fills content from a sent post without linking to it — save() still
  // takes the create path (no `post` id), so this becomes a brand-new post
  // with fresh, empty recipients rather than rewriting send history.
  duplicateFrom?: PostRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const confirm = useConfirm();
  const source = post ?? duplicateFrom;
  const [type, setType] = useState<PostType>(source?.type ?? "update");
  const [title, setTitle] = useState(source?.title ?? "");
  const [projectIds, setProjectIds] = useState<string[]>(source?.project_ids ?? []);
  const [attachments, setAttachments] = useState<PostAttachment[]>(source?.attachments ?? []);
  const [mode, setMode] = useState<RecipientMode>(post?.recipient_mode ?? "none");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [showRecipients, setShowRecipients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingPost, setSendingPost] = useState<SendablePost | null>(null);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [oversizeQueue, setOversizeQueue] = useState<File[]>([]);
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

  const { data: emailContacts, isLoading: emailContactsLoading } = useQuery({
    queryKey: ["admin-email-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_contacts")
        .select("id, email, name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailListContact[];
    },
  });

  const recipientSummaryCount = useMemo(() => {
    const deduped = dedupeContactsByEmail(contacts ?? []);
    const includedEmails = includedContactEmails(mode, deduped, selectedIds);
    const uniqueCustomCount = customEmails.filter(
      (e) => !includedEmails.has(e.trim().toLowerCase()),
    ).length;
    const fromRecordsCount = mode === "all" ? deduped.length : mode === "selected" ? selectedIds.size : 0;
    return fromRecordsCount + uniqueCustomCount;
  }, [contacts, mode, selectedIds, customEmails]);

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
    content: source?.body_html ?? "",
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
    const compressed = await Promise.all(Array.from(files).map(compressImage));
    const okFiles = compressed.filter((f) => !isOversizedFile(f));
    const oversized = compressed.filter((f) => isOversizedFile(f));
    if (oversized.length > 0) setOversizeQueue((q) => [...q, ...oversized]);
    if (okFiles.length === 0) {
      setUploadingAttachments(false);
      return;
    }

    try {
      for (const file of okFiles) {
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

  function addAttachmentLink(file: File, link: string) {
    setAttachments((prev) => [
      ...prev,
      { url: link, name: file.name, contentType: file.type, kind: "document", isExternalLink: true },
    ]);
    setOversizeQueue((q) => q.slice(1));
    toast.success("Link saved");
  }

  function removeAttachment(index: number) {
    const attachment = attachments[index];
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    if (!attachment || attachment.isExternalLink) return;
    const path = storagePathFromUrl(attachment.url, "site-media");
    if (!path) return;
    deleteSiteMedia({ data: { path } }).catch((err) => console.error(err));
  }

  async function save(action: "draft" | "send") {
    if (!title.trim()) {
      toast.error("Give this post a title");
      return;
    }
    if (!editor || editor.isEmpty) {
      toast.error("Write something before posting");
      return;
    }
    if (action === "send") {
      if (recipientSummaryCount === 0) {
        toast.error("Add at least one recipient first");
        return;
      }
      const count = recipientSummaryCount;
      if (!(await confirm(`Send this post to ${count} recipient${count === 1 ? "" : "s"}?`))) {
        return;
      }
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
      let id: string;
      if (post) {
        await doUpdate({ data: { id: post.id, ...input } });
        id = post.id;
      } else {
        const result = await doCreate({ data: input });
        id = result.id;
      }
      if (action === "send") {
        const { data, error } = await supabase
          .from("posts")
          .select("id, total_count, sent_count, failed_count")
          .eq("id", id)
          .single();
        if (error || !data) throw new Error("Post saved, but failed to start sending");
        setSendingPost(data as SendablePost);
      } else {
        toast.success(post ? "Post updated" : "Draft saved");
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={sendingPost ? undefined : onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">
            {sendingPost ? "Sending…" : post ? "Edit post" : "Create post"}
          </h2>
          {!sendingPost && (
            <button
              onClick={onClose}
              className="absolute right-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
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
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <AttachmentTile key={a.url} a={a} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          )}

          {oversizeQueue.length > 0 && (
            <OversizeFileLinkPrompt
              fileName={oversizeQueue[0].name}
              onCancel={() => setOversizeQueue((q) => q.slice(1))}
              onSave={(link) => addAttachmentLink(oversizeQueue[0], link)}
            />
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

          <button
            type="button"
            onClick={() => setShowRecipients(true)}
            className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <Plus className="h-3 w-3 text-muted-foreground" />
            {recipientSummaryCount > 0
              ? `${recipientSummaryCount} recipient${recipientSummaryCount === 1 ? "" : "s"}`
              : "Add recipients"}
          </button>

          {showRecipients && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
              onClick={() => setShowRecipients(false)}
            >
              <div
                className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Recipients</h3>
                  <button
                    onClick={() => setShowRecipients(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <RecipientPicker
                  contacts={contacts ?? []}
                  contactsLoading={contactsLoading}
                  emailContacts={emailContacts ?? []}
                  emailContactsLoading={emailContactsLoading}
                  mode={mode}
                  onModeChange={setMode}
                  selectedIds={selectedIds}
                  onToggleContact={toggleContact}
                  customEmails={customEmails}
                  onAddCustom={addCustomEmail}
                  onRemoveCustom={removeCustomEmail}
                />
                <button
                  type="button"
                  onClick={() => setShowRecipients(false)}
                  className="mt-3 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {sendingPost ? (
            <SendProgress
              post={sendingPost}
              retryFailed={false}
              onDone={() => {
                setSendingPost(null);
                onSaved();
              }}
            />
          ) : (
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
                onClick={() => save("draft")}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => save("send")}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
