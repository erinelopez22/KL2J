import { isValidEmail } from "@/lib/email";

// Minimal RFC4180-ish CSV parser for the bulk email-contact import — no
// external dependency needed (avoids pulling in a spreadsheet-parsing
// library just for this). Expects a header row with an "email" column and
// an optional "name" column (case-insensitive).
export function parseContactsCsv(text: string): {
  contacts: { email: string; name?: string }[];
  skipped: number;
} {
  const rows = parseRows(text);
  if (rows.length === 0) return { contacts: [], skipped: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const emailCol = header.indexOf("email");
  if (emailCol === -1) {
    throw new Error('CSV must have an "email" column');
  }
  const nameCol = header.indexOf("name");

  const contacts: { email: string; name?: string }[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const email = row[emailCol]?.trim();
    if (!email) continue;
    if (!isValidEmail(email)) {
      skipped++;
      continue;
    }
    const name = nameCol !== -1 ? row[nameCol]?.trim() : undefined;
    contacts.push({ email, name: name || undefined });
  }
  return { contacts, skipped };
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}
