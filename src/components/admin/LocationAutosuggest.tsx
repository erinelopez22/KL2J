import { useEffect, useRef, useState } from "react";
import { loadPhilippineLocations } from "@/lib/admin/philippineLocations";

export function LocationAutosuggest({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [allLocations, setAllLocations] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPhilippineLocations().then(setAllLocations);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const suggestions =
    allLocations && query.length >= 2 ? allLocations.filter((loc) => loc.toLowerCase().includes(query)).slice(0, 8) : [];

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={allLocations ? "Barangay, city/municipality, province" : "Loading locations…"}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
