"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type EditChildModalProps = {
  open: boolean;
  childId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export default function EditChildModal({
  open,
  childId,
  onClose,
  onUpdated,
}: EditChildModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");

  const canSave = useMemo(() => {
    return firstName.trim().length > 0 && lastName.trim().length > 0;
  }, [firstName, lastName]);

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!open) return;
      if (!childId) return;

      setError(null);
      setLoading(true);

      try {
        if (!supabase) throw new Error("Missing Supabase env vars.");

        const { data, error } = await supabase
          .from("children")
          .select("id, first_name, last_name, dob")
          .eq("id", childId)
          .single();

        if (error) throw error;
        if (cancelled) return;

        setFirstName((data?.first_name ?? "") as string);
        setLastName((data?.last_name ?? "") as string);
        setDob((data?.dob ?? "") as string);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(err) ?? "Failed to load child.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, childId]);

  async function handleSave() {
    if (!open) return;
    if (!childId) return;

    setError(null);

    if (!supabase) {
      setError("Missing Supabase env vars.");
      return;
    }

    if (!canSave) {
      setError("First name and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const payload: { first_name: string; last_name: string; dob: string | null } =
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: dob.trim().length > 0 ? dob.trim() : null,
        };

      const { error } = await supabase
        .from("children")
        .update(payload)
        .eq("id", childId);

      if (error) throw error;

      onUpdated?.();
      handleClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err) ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

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
            <p className="text-sm font-semibold text-slate-900">Edit child</p>
            <p className="text-xs text-slate-500">Update child details</p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-xl border bg-slate-50 p-3">
              <p className="text-sm text-slate-700">Loading…</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  First name
                </label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Last name
                </label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  DOB
                </label>
                <input
                  type="date"
                  value={dob ?? ""}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
                <p className="text-[11px] text-slate-500">
                  Used for age bucket auto-assignment on check-in.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving || loading}
            className="w-full rounded-xl bg-teal-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

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
