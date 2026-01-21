"use client";

import { ReactNode, useEffect } from "react";

export type CheckInModalProps = {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (v: string) => void;
  children: ReactNode;
};

export default function CheckInModal({
  open,
  onClose,
  query,
  onQueryChange,
  children,
}: CheckInModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-2 pt-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop click closes */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Check In</p>
            <p className="text-xs text-slate-500">Search child, then select guardian</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {/* 
          Key change:
          - panel body scrolls (so keyboard doesn't trap the input)
          - uses dvh so it respects mobile browser UI better than vh
        */}
        <div className="max-h-[80dvh] overflow-y-auto px-4 py-4 space-y-3">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Search child
            </label>
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Type name…"
              autoFocus
              inputMode="search"
              className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
            />
          </div>

          {children}
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
