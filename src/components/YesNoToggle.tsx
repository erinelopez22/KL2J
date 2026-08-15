// Two-button Yes/No choice for checklist questions like "Is it Titled?".
// Neither button starts active — `value` stays `undefined` until the
// customer picks one, so "unanswered" is distinguishable from "No"
// (a plain checkbox defaulting to unchecked can't tell those apart).
export function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value === true}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
          value === true
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card hover:bg-muted"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={value === false}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
          value === false
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card hover:bg-muted"
        }`}
      >
        No
      </button>
    </div>
  );
}
