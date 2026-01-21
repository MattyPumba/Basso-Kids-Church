"use client";

import { useMemo } from "react";

type AllergenItem = {
  label: string;
  key: string; // lowercase for stable de-dupe
};

type AllergiesModalProps = {
  open: boolean;
  onClose: () => void;
  checkedIn: Array<{
    child_id: string;
    children:
      | Array<{
          id: string;
          first_name: string;
          last_name: string;
          allergies?: string | null;
        }>
      | null;
  }>;
};

function parseAllergens(raw: string): AllergenItem[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ label, key: label.toLowerCase() }));
}

export default function AllergiesModal({
  open,
  onClose,
  checkedIn,
}: AllergiesModalProps) {
  const inPlay = useMemo(() => {
    const kidsWithAllergies: Array<{
      child_id: string;
      name: string;
      allergies: string;
      allergens: AllergenItem[];
    }> = [];

    const allergenMap = new Map<string, string>(); // key -> label (first-seen)

    for (const row of checkedIn) {
      if (!row.children || row.children.length === 0) continue;
      const c = row.children[0];

      const raw = (c.allergies ?? "").trim();
      if (!raw) continue;

      const allergens = parseAllergens(raw);
      for (const a of allergens) {
        if (!allergenMap.has(a.key)) allergenMap.set(a.key, a.label);
      }

      kidsWithAllergies.push({
        child_id: row.child_id,
        name: `${c.first_name} ${c.last_name}`,
        allergies: raw,
        allergens,
      });
    }

    const uniqueAllergens = Array.from(allergenMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    kidsWithAllergies.sort((a, b) => a.name.localeCompare(b.name));

    return { uniqueAllergens, kidsWithAllergies };
  }, [checkedIn]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Allergies in play
            </p>
            <p className="text-xs text-slate-500">
              Attendance list for this Sunday (checked in or checked out)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-3">
          {inPlay.kidsWithAllergies.length === 0 ? (
            <div className="rounded-xl border bg-slate-50 p-3">
              <p className="text-sm text-slate-700">No allergies in play.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">
                  Allergens present
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {inPlay.uniqueAllergens.map((a) => (
                    <span
                      key={a.key}
                      className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="divide-y rounded-xl border">
                {inPlay.kidsWithAllergies.map((k) => (
                  <div key={k.child_id} className="px-3 py-3">
                    <p className="text-sm font-medium text-slate-900">{k.name}</p>
                    <p className="text-xs text-slate-600">{k.allergies}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
