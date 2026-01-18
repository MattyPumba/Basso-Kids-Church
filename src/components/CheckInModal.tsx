"use client";

import { ReactNode, useEffect, useState } from "react";

type CheckInModalProps = {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
};

export default function CheckInModal({
  open,
  onClose,
}: CheckInModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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
            <p className="text-sm font-semibold text-slate-900">Check In</p>
            <p className="text-xs text-slate-500">
              Search and select a child
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <input
            type="text"
            placeholder="Search by child name or parent phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />

          <div className="rounded-xl border bg-slate-50 p-3">
            <p className="text-sm text-slate-600">
              No results yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Search will connect to children records next.
            </p>
          </div>
        </div>

        <div className="border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
