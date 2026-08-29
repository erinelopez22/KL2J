// Shared "Public" switch — same look/interaction everywhere something has
// a public/hidden toggle (Projects, Gallery folders). Extracted so both
// stay visually identical instead of drifting apart as separate copies.
export function PublicToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      aria-pressed={checked}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium uppercase transition-colors ${
        checked ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      Public
    </button>
  );
}
