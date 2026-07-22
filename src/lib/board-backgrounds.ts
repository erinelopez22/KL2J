export const BOARD_BACKGROUNDS = [
  { key: "blue", label: "Blue", className: "bg-board-blue" },
  { key: "purple", label: "Purple", className: "bg-board-purple" },
  { key: "teal", label: "Teal", className: "bg-board-teal" },
  { key: "orange", label: "Orange", className: "bg-board-orange" },
  { key: "pink", label: "Pink", className: "bg-board-pink" },
  { key: "gray", label: "Gray", className: "bg-board-gray" },
] as const;

export function bgClass(key: string | null | undefined) {
  return BOARD_BACKGROUNDS.find((b) => b.key === key)?.className ?? "bg-board-blue";
}

export const LABEL_COLORS = [
  { key: "green", hex: "#4BCE97" },
  { key: "yellow", hex: "#F5CD47" },
  { key: "orange", hex: "#FEA362" },
  { key: "red", hex: "#F87168" },
  { key: "purple", hex: "#9F8FEF" },
  { key: "blue", hex: "#579DFF" },
] as const;
