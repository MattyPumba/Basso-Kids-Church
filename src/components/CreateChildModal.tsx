"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CreateChildModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

type FormState = {
  first_name: string;
  last_name: string;
  dob: string; // YYYY-MM-DD
  parent_name: string;
  parent_phone: string;
  allergies: string;
  medical_notes: string;
  notes: string;
};

type GuardianRow = {
  id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  active: boolean | null;
};

const initialState: FormState = {
  first_name: "",
  last_name: "",
  dob: "",
  parent_name: "",
  parent_phone: "",
  allergies: "",
  medical_notes: "",
  notes: "",
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

export default function CreateChildModal({
  open,
  onClose,
  onCreated,
}: CreateChildModalProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guardian linking UI (search existing guardians + select)
  const [guardianQuery, setGuardianQuery] = useState("");
  const trimmedGuardianQuery = useMemo(
    () => guardianQuery.trim(),
    [guardianQuery]
  );

  const [guardianResults, setGuardianResults] = useState<GuardianRow[]>([]);
  const [guardianSearching, setGuardianSearching] = useState(false);
  const [guardianSearchError, setGuardianSearchError] = useState<string | null>(
    null
  );

  const [selectedGuardians, setSelectedGuardians] = useState<GuardianRow[]>([]);

  const canSave = useMemo(() => {
    return (
      form.first_name.trim().length > 0 &&
      form.last_name.trim().length > 0 &&
      form.dob.trim().length > 0
    );
  }, [form]);

  const handleClose = useCallback(() => {
    if (saving) return;
    setError(null);
    setForm(initialState);

    setGuardianQuery("");
    setGuardianResults([]);
    setGuardianSearching(false);
    setGuardianSearchError(null);
    setSelectedGuardians([]);

    onClose();
  }, [onClose, saving]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  // Search guardians while modal open
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setGuardianSearchError(null);

      if (!open) return;

      if (!supabase) {
        setGuardianSearchError("Missing Supabase env vars.");
        setGuardianResults([]);
        return;
      }

      if (trimmedGuardianQuery.length < 2) {
        setGuardianResults([]);
        return;
      }

      setGuardianSearching(true);
      try {
        const q = trimmedGuardianQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");
        const pattern = `%${q}%`;

        const { data, error } = await supabase
          .from("guardians")
          .select("id,full_name,relationship,phone,active")
          .eq("active", true)
          .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
          .order("full_name", { ascending: true })
          .limit(20);

        if (error) throw error;
        if (cancelled) return;

        setGuardianResults((data ?? []) as GuardianRow[]);
      } catch (err: unknown) {
        if (cancelled) return;
        setGuardianSearchError(getErrorMessage(err) ?? "Guardian search failed.");
        setGuardianResults([]);
      } finally {
        if (!cancelled) setGuardianSearching(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, trimmedGuardianQuery]);

  function addGuardianToSelection(g: GuardianRow) {
    setSelectedGuardians((prev) => {
      if (prev.some((x) => x.id === g.id)) return prev;
      return [...prev, g];
    });
  }

  function removeGuardianFromSelection(id: string) {
    setSelectedGuardians((prev) => prev.filter((g) => g.id !== id));
  }

  if (!open) return null;

  async function handleSave() {
    setError(null);

    if (!supabase) {
      setError(
        "Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL/ANON_KEY."
      );
      return;
    }

    if (!canSave) {
      setError("Please fill first name, last name, and DOB.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        dob: form.dob.trim(),
        parent_name: form.parent_name.trim() || null,
        parent_phone: form.parent_phone.trim() || null,
        allergies: form.allergies.trim() || null,
        medical_notes: form.medical_notes.trim() || null,
        notes: form.notes.trim() || null,
        active: true,
      };

      // Insert child and return id
      const { data: childData, error: insertError } = await supabase
        .from("children")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!childData?.id) throw new Error("Child insert did not return an id.");

      // Link selected guardians via child_guardians
      if (selectedGuardians.length > 0) {
        const links = selectedGuardians.map((g) => ({
          child_id: childData.id,
          guardian_id: g.id,
          active: true,
        }));

        const { error: linkErr } = await supabase
          .from("child_guardians")
          .insert(links);

        if (linkErr) throw linkErr;
      }

      onCreated?.();
      handleClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err) ?? "Failed to create child.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">New Child</p>
            <p className="text-xs text-slate-500">Create a child record</p>
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

        <div className="px-4 py-4 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                First name *
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, first_name: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Last name *
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, last_name: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">DOB *</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dob: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Parent phone
              </label>
              <input
                type="tel"
                value={form.parent_phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, parent_phone: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Parent name
            </label>
            <input
              type="text"
              value={form.parent_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, parent_name: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Allergies
            </label>
            <input
              type="text"
              value={form.allergies}
              onChange={(e) =>
                setForm((p) => ({ ...p, allergies: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="e.g. Nuts, dairy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Medical notes
            </label>
            <textarea
              value={form.medical_notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, medical_notes: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          {/* Approved guardians section */}
          <div className="rounded-2xl border p-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Approved guardians
              </p>
              <p className="text-xs text-slate-500">
                Link existing guardians to this child.
              </p>
            </div>

            {selectedGuardians.length > 0 ? (
              <div className="space-y-2">
                {selectedGuardians.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {g.full_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {g.relationship ? g.relationship : "—"}
                        {g.phone ? ` • ${g.phone}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGuardianFromSelection(g.id)}
                      className="rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm text-slate-700">
                  No guardians linked yet.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={guardianQuery}
                onChange={(e) => setGuardianQuery(e.target.value)}
                placeholder="Search guardians by name or phone"
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />

              {guardianSearchError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {guardianSearchError}
                </div>
              ) : null}

              {trimmedGuardianQuery.length < 2 ? (
                <p className="text-xs text-slate-500">
                  Type at least 2 characters to search.
                </p>
              ) : guardianSearching ? (
                <p className="text-xs text-slate-500">Searching…</p>
              ) : guardianResults.length === 0 ? (
                <p className="text-xs text-slate-500">No matches.</p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {guardianResults.map((g) => {
                    const already = selectedGuardians.some((x) => x.id === g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => addGuardianToSelection(g)}
                        disabled={already}
                        className="w-full px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {g.full_name}
                          {already ? " (linked)" : ""}
                        </p>
                        <p className="text-xs text-slate-600">
                          {g.relationship ? g.relationship : "—"}
                          {g.phone ? ` • ${g.phone}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 space-y-2">
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={handleSave}
            className="w-full rounded-xl bg-teal-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save child"}
          </button>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
