// Area-type checklist questions are configured by admins with unit "sqm",
// but customers may know their lot size in hectares — this lets them pick
// either and stores the combined "<value> <unit>" text in the same
// free-text `answer` field every other part of the app already reads.
export type AreaUnit = "sqm" | "hectares";

const UNIT_SUFFIX: Record<AreaUnit, string> = { sqm: "sqm", hectares: "hectares" };

export function splitAreaAnswer(answer: string | undefined): { value: string; unit: AreaUnit } {
  const trimmed = (answer ?? "").trim();
  const match = trimmed.match(/^(.*?)\s*(sqm|hectares)$/i);
  if (match) {
    const unit = match[2].toLowerCase() === "hectares" ? "hectares" : "sqm";
    return { value: match[1].trim(), unit };
  }
  return { value: trimmed, unit: "sqm" };
}

export function joinAreaAnswer(value: string, unit: AreaUnit): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";
  return `${trimmedValue} ${UNIT_SUFFIX[unit]}`;
}
