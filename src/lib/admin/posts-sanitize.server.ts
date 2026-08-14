// Server-only. Dynamically import this inside server function handlers —
// never top-level import from *.functions.ts or route files (see the
// warning in src/integrations/supabase/client.server.ts).
import sanitizeHtml from "sanitize-html";

// body_html is admin-authored rich text that gets embedded verbatim into
// outbound emails sent to real customers, so this allowlist is deliberately
// tight — no class/on* attributes, no script/iframe, images limited to
// src/alt so nothing can smuggle a tracking pixel with extra params.
//
// `span[style]` is allowed for exactly three CSS properties (font
// family/size/color, set by the editor's formatting toolbar) via
// `allowedStyles`, each checked against a strict regex — no url()/semicolon
// injection surface, since none of these properties are ever interpreted as
// a place to embed a nested value in the way `background`/`content` are.
//
// Colors are accepted as hex (what the toolbar's swatches/color-input use)
// OR rgb(r,g,b) (0-255 per channel) — Chromium normalizes hex to rgb() when
// TipTap's getHTML() serializes the DOM, so both forms genuinely occur.
const RGB_CHANNEL = "(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)";
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR = new RegExp(`^rgb\\(\\s*${RGB_CHANNEL}\\s*,\\s*${RGB_CHANNEL}\\s*,\\s*${RGB_CHANNEL}\\s*\\)$`);
const FONT_SIZE = /^\d{1,3}px$/;
const FONT_FAMILY = /^[a-zA-Z0-9 ,'"-]{1,60}$/;

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "b",
      "strong",
      "i",
      "em",
      "u",
      "span",
      "p",
      "br",
      "a",
      "img",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "blockquote",
    ],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
      span: ["style"],
    },
    allowedStyles: {
      span: {
        color: [HEX_COLOR, RGB_COLOR],
        "font-size": [FONT_SIZE],
        "font-family": [FONT_FAMILY],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  });
}
