"use client";

import { useMemo } from "react";

type BirthdaysModalProps = {
  open: boolean;
  onClose: () => void;
  serviceSunday: Date;
  checkedIn: Array<{
    child_id: string;
    children:
      | Array<{
          id: string;
          first_name: string;
          last_name: string;
          dob: string | null;
        }>
      | null;
  }>;
};

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function formatShortDayLabel(d: Date): string {
  return d.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function sameMonthDay(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function BirthdaysModal({
  open,
  onClose,
  serviceSunday,
  checkedIn,
}: BirthdaysModalProps) {
  const birthdaysLast7Days = useMemo(() => {
    // serviceSunday inclusive, and the 6 days prior
    const days: Date[] = [];
    for (let i = 6; i >= 0; i -= 1) days.push(addDays(serviceSunday, -i));

    const items: Array<{
      child_id: string;
      name: string;
      matchedDate: Date;
    }> = [];

    const seen = new Set<string>();

    for (const row of checkedIn) {
      if (!row.children || row.children.length === 0) continue;
      const c = row.children[0];
      if (!c.dob) continue;

      const dob = new Date(c.dob);
      if (Number.isNaN(dob.getTime())) continue;

      for (const d of days) {
        if (sameMonthDay(dob, d)) {
          if (!seen.has(row.child_id)) {
            seen.add(row.child_id);
            items.push({
              child_id: row.child_id,
              name: `${c.first_name} ${c.last_name}`,
              matchedDate: d,
            });
          }
          break;
        }
      }
    }

    items.sort((a, b) => a.matchedDate.getTime() - b.matchedDate.getTime());
    return items;
  }, [checkedIn, serviceSunday]);

  if (!open) return null;

  const rangeStart = addDays(serviceSunday, -6);

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
              Birthdays (last 7 days)
            </p>
            <p className="text-xs text-slate-500">
              Checked-in kids only • {formatShortDayLabel(rangeStart)} –{" "}
              {formatShortDayLabel(serviceSunday)}
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

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {birthdaysLast7Days.length === 0 ? (
            <div className="rounded-xl border bg-slate-50 p-3">
              <p className="text-sm text-slate-700">None</p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {birthdaysLast7Days.map((b) => (
                <div
                  key={b.child_id}
                  className="flex items-center justify-between gap-3 px-3 py-3"
                >
                  <p className="text-sm font-medium text-slate-900">{b.name}</p>
                  <p className="text-xs text-slate-600">
                    {formatShortDayLabel(b.matchedDate)}
                  </p>
                </div>
              ))}
            </div>
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
