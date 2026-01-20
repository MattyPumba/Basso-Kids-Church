"use client";

import { ReactNode, useCallback, useEffect } from "react";

type ManageModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
};

export default function ManageModal({
  open,
  onClose,
  title = "Manage",
  subtitle = "Edit child or guardian details",
  children,
}: ManageModalProps) {
  const handleClose = useCallback(() => {
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
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-2"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
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
          {children ? (
            children
          ) : (
            <div className="rounded-xl border bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                Coming next: search Children / Guardians and edit details.
              </p>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
