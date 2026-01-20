"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type EditGuardianModalProps = {
  open: boolean;
  guardianId: string | null;
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

export default function EditGuardianModal({
  open,
  guardianId,
  onClose,
  onUpdated,
}: EditGuardianModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");

  const canSave = useMemo(() => {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      phone.trim().length > 0
    );
  }, [firstName, lastName, phone]);

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
      if (!guardianId) return;

      setError(null);
      setLoading(true);

      try {
        if (!supabase) throw new Error("Missing Supabase env vars.");

        const { data, error } = await supabase
          .from("guardians")
          .select("id, first_name, last_name, relationship, phone")
          .eq("id", guardianId)
          .single();

        if (error) throw error;
        if (cancelled) return;

        setFirstName((data?.first_name ?? "") as string);
        setLastName((data?.last_name ?? "") as string);
        setRelationship((data?.relationship ?? "") as string);
        setPhone((data?.phone ?? "") as string);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(err) ?? "Failed to load guardian.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, guardianId]);

  async function handleSave() {
    if (!open) return;
    if (!guardianId) return;

    setError(null);

    if (!supabase) {
      setError("Missing Supabase env vars.");
      return;
    }

    if (!canSave) {
      setError("First name, last name, and phone are required.");
      return;
    }

    setSaving(true);
    try {
      const payload: {
        first_name: string;
        last_name: string;
        relationship: string | null;
        phone: string;
      } = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        relationship: relationship.trim().length > 0 ? relationship.trim() : null,
        phone: phone.trim(),
      };

      const { error } = await supabase
        .from("guardians")
        .update(payload)
        .eq("id", guardianId);

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
            <p className="text-sm font-semibold text-slate-900">Edit guardian</p>
            <p className="text-xs text-slate-500">Update guardian details</p>
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
                  Phone
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
                <p className="text-[11px] text-slate-500">
                  Must stay unique for each guardian (per your Supabase constraint).
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Relationship
                </label>
                <input
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                  placeholder="Mum, Dad, Nan, Pop…"
                />
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
