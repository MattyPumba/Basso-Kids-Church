"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";

type CheckInModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  onNewChild?: () => void;
};

export default function CheckInModal({
  open,
  onClose,
  children,
  onNewChild,
}: CheckInModalProps) {
  const [query, setQuery] = useState("");

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

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
            <p className="text-xs text-slate-500">Search and select a child</p>
          </div>

          <button
            type="button"
            onClick={handleClose}
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

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onNewChild}
              className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={!onNewChild}
            >
              New child
            </button>
          </div>

          {children}
        </div>

        <div className="border-t px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
