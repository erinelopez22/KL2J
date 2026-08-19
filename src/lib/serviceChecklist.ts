import type { ChecklistItem } from "@/lib/admin/services.functions";

function stripRequiredSuffix(label: string): string {
  return label.replace(/\s*\((?:optional|required)\)\s*$/i, "").trim();
}

/**
 * Combines the checklists of every selected service into one list, in
 * question order across the selected services. Different services define
 * their own checklist items with their own ids, so two services can ask the
 * same question (e.g. "Number of Lots to subdivide into") under different
 * ids — dedup on the question text itself (case/whitespace-insensitive)
 * rather than id, so the merged form never repeats a question.
 *
 * Document-upload items get extra handling: every service tends to phrase
 * its "send us your supporting docs" ask differently even though it's
 * conceptually the same single upload slot, so when more than one distinct
 * document item shows up across the selected services, they're combined
 * into one item (one upload box) whose label joins the distinct wording and
 * whose `required` is true if any contributing service required theirs.
 */
export function mergeChecklists(
  allServices: { title: string; checklist: ChecklistItem[] }[],
  selectedTitles: string[],
): ChecklistItem[] {
  const merged: ChecklistItem[] = [];
  const seenLabels = new Set<string>();
  const seenDocumentLabels = new Set<string>();
  const documentLabels: string[] = [];
  let documentRequired = false;
  let documentSlotIndex = -1;
  let firstDocumentItem: ChecklistItem | null = null;

  for (const title of selectedTitles) {
    const service = allServices.find((s) => s.title === title);
    if (!service) continue;
    for (const item of service.checklist ?? []) {
      if (item.type === "document") {
        const cleanLabel = stripRequiredSuffix(item.label);
        const key = cleanLabel.toLowerCase();
        if (seenDocumentLabels.has(key)) continue;
        seenDocumentLabels.add(key);
        documentLabels.push(cleanLabel);
        if (item.required !== false) documentRequired = true;
        if (documentSlotIndex === -1) {
          firstDocumentItem = item;
          documentSlotIndex = merged.length;
          merged.push(item);
        }
        continue;
      }
      const key = item.label.trim().toLowerCase().replace(/\s+/g, " ");
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);
      merged.push(item);
    }
  }

  if (documentSlotIndex !== -1 && documentLabels.length > 1) {
    merged[documentSlotIndex] = {
      ...firstDocumentItem!,
      id: "merged-documents",
      label: documentLabels.join(" / "),
      required: documentRequired,
    };
  }

  return merged;
}
