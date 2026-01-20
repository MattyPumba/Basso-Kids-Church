"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import CreateGuardianInline, {
  GuardianRow as GuardianInlineRow,
} from "@/components/CreateGuardianInline";

type CreateChildModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

type GuardianRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  active: boolean | null;
};

type NewChildState = {
  first_name: string;
  last_name: string;
  dob: string;
  allergies: string;
  medical_notes: string;
  notes: string;
};

const initialChildState: NewChildState = {
  first_name: "",
  last_name: "",
  dob: "",
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<NewChildState>(initialChildState);

  const [linkedGuardians, setLinkedGuardians] = useState<GuardianRow[]>([]);
  const [linking, setLinking] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const trimmedSearch = useMemo(() => search.trim(), [search]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GuardianRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [createGuardianOpen, setCreateGuardianOpen] = useState(false);

  const canSave = useMemo(() => {
    return (
      form.first_name.trim().length > 0 &&
      form.last_name.trim().length > 0 &&
      form.dob.trim().length > 0
    );
  }, [form.first_name, form.last_name, form.dob]);

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
    if (!open) return;

    setError(null);
    setGuardianError(null);
    setSearchError(null);
    setSearchResults([]);
    setSearch("");
    setCreateGuardianOpen(false);

    setForm(initialChildState);
    setLinkedGuardians([]);
  }, [open]);

  async function runSearch() {
    setSearchError(null);
    setSearchResults([]);

    if (!open) return;

    if (!supabase) {
      setSearchError("Missing Supabase env vars.");
      return;
    }

    if (trimmedSearch.length < 2) return;

    setSearching(true);
    try {
      const q = trimmedSearch.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const pattern = `%${q}%`;

      const { data, error } = await supabase
        .from("guardians")
        .select("id, first_name, last_name, full_name, phone, active")
        .eq("active", true)
        .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
        .order("full_name", { ascending: true })
        .limit(25);

      if (error) throw error;

      const linkedIds = new Set(linkedGuardians.map((g) => g.id));
      const list = ((data ?? []) as GuardianRow[]).filter((g) => !linkedIds.has(g.id));

      setSearchResults(list);
    } catch (err: unknown) {
      setSearchError(getErrorMessage(err) ?? "Search failed.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    runSearch();
  }, [trimmedSearch, linkedGuardians, open]);

  function addExistingGuardian(g: GuardianRow) {
    setGuardianError(null);

    const seen = new Set(linkedGuardians.map((x) => x.id));
    if (seen.has(g.id)) return;

    setLinkedGuardians((prev) => [...prev, g]);
    setSearch("");
    setSearchResults([]);
  }

  function removeLinkedGuardian(id: string) {
    setGuardianError(null);
    setLinkedGuardians((prev) => prev.filter((g) => g.id !== id));
  }

  async function handleGuardianCreatedInline(
    g: GuardianInlineRow,
    _relationshipForChild?: string
  ) {
    setGuardianError(null);
    setLinking(true);
    try {
      const asGuardian: GuardianRow = {
        id: g.id,
        first_name: g.first_name ?? null,
        last_name: g.last_name ?? null,
        full_name: g.full_name ?? null,
        phone: g.phone ?? null,
        active: g.active ?? null,
      };

      setLinkedGuardians((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        if (seen.has(asGuardian.id)) return prev;
        return [...prev, asGuardian];
      });

      setCreateGuardianOpen(false);
      setSearch("");
      setSearchResults([]);
    } catch (err: unknown) {
      setGuardianError(getErrorMessage(err) ?? "Failed to add new guardian.");
    } finally {
      setLinking(false);
    }
  }

  async function handleSave() {
    setError(null);
    setGuardianError(null);

    if (!supabase) {
      setError("Missing Supabase env vars.");
      return;
    }

    if (!canSave) {
      setError("First name, last name, and DOB are required.");
      return;
    }

    setSaving(true);
    try {
      const childPayload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        dob: form.dob.trim(),
        allergies: form.allergies.trim().length > 0 ? form.allergies.trim() : null,
        medical_notes:
          form.medical_notes.trim().length > 0 ? form.medical_notes.trim() : null,
        notes: form.notes.trim().length > 0 ? form.notes.trim() : null,
        active: true,
      };

      const { data: child, error: childErr } = await supabase
        .from("children")
        .insert(childPayload)
        .select("id")
        .single();

      if (childErr) throw childErr;
      if (!child?.id) throw new Error("Child insert did not return id.");

      if (linkedGuardians.length > 0) {
        const linksPayload = linkedGuardians.map((g) => ({
          child_id: child.id as string,
          guardian_id: g.id,
          active: true,
        }));

        const { error: linkErr } = await supabase.from("child_guardians").insert(linksPayload);
        if (linkErr) throw linkErr;
      }

      onCreated?.();
      handleClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err) ?? "Failed to save child.");
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
            <p className="text-sm font-semibold text-slate-900">New Child</p>
            <p className="text-xs text-slate-500">Create a child record</p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                First name *
              </label>
              <input
                value={form.first_name}
                onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Last name *
              </label>
              <input
                value={form.last_name}
                onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              DOB *
            </label>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))}
              className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Allergies
            </label>
            <input
              value={form.allergies}
              onChange={(e) => setForm((p) => ({ ...p, allergies: e.target.value }))}
              placeholder="e.g. Nuts, dairy"
              className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Medical notes
            </label>
            <textarea
              value={form.medical_notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, medical_notes: e.target.value }))
              }
              className="w-full min-h-[90px] rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full min-h-[90px] rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
            />
          </div>

          <div className="rounded-2xl border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Approved guardians
                </p>
                <p className="text-xs text-slate-500">
                  Link guardians to this child.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreateGuardianOpen((v) => !v)}
                disabled={linking}
                className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {createGuardianOpen ? "Close" : "Create guardian"}
              </button>
            </div>

            {guardianError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {guardianError}
              </div>
            ) : null}

            {createGuardianOpen ? (
              <CreateGuardianInline
                onCreated={handleGuardianCreatedInline}
                disabled={linking}
              />
            ) : null}

            {linkedGuardians.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm text-slate-700">No guardians linked yet.</p>
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {linkedGuardians.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {g.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-600">
                        {g.phone ? g.phone : "Phone —"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLinkedGuardian(g.id)}
                      className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Search guardians by name or phone
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or phone…"
                className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
              />
            </div>

            {searchError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {searchError}
              </div>
            ) : null}

            {searching ? (
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm text-slate-700">Searching…</p>
              </div>
            ) : trimmedSearch.length >= 2 && searchResults.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm text-slate-700">No matches found.</p>
              </div>
            ) : searchResults.length === 0 ? null : (
              <div className="divide-y rounded-xl border">
                {searchResults.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => addExistingGuardian(g)}
                    disabled={linking}
                    className="w-full px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {g.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-slate-600">
                      {g.phone ? g.phone : "Phone —"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Tap to add as approved guardian
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-4 py-3 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save child"}
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
