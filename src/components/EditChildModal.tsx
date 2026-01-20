"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import CreateGuardianInline, {
  GuardianRow as GuardianInlineRow,
} from "@/components/CreateGuardianInline";

type EditChildModalProps = {
  open: boolean;
  childId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

type GuardianRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  relationship: string | null;
  phone: string | null;
  active: boolean | null;
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
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [notes, setNotes] = useState("");

  const [linkedGuardians, setLinkedGuardians] = useState<GuardianRow[]>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const trimmedSearch = useMemo(() => search.trim(), [search]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GuardianRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [createGuardianOpen, setCreateGuardianOpen] = useState(false);

  const canSave = useMemo(() => {
    return firstName.trim().length > 0 && lastName.trim().length > 0 && dob.trim().length > 0;
  }, [firstName, lastName, dob]);

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

  async function loadLinkedGuardians(forChildId: string) {
    setGuardianError(null);
    setLinkedGuardians([]);

    if (!supabase) {
      setGuardianError("Missing Supabase env vars.");
      return;
    }

    setLoadingGuardians(true);
    try {
      const { data: links, error: linkErr } = await supabase
        .from("child_guardians")
        .select("guardian_id, active")
        .eq("child_id", forChildId);

      if (linkErr) throw linkErr;

      const activeIds = (links ?? [])
        .filter((r) => (r as { active: boolean | null }).active !== false)
        .map((r) => (r as { guardian_id: string | null }).guardian_id)
        .filter((id): id is string => !!id);

      if (activeIds.length === 0) {
        setLinkedGuardians([]);
        return;
      }

      const { data: gs, error: gErr } = await supabase
        .from("guardians")
        .select("id, first_name, last_name, full_name, relationship, phone, active")
        .in("id", activeIds);

      if (gErr) throw gErr;

      const list = ((gs ?? []) as GuardianRow[]).filter((g) => g.active !== false);

      const seen = new Set<string>();
      const deduped: GuardianRow[] = [];
      for (const g of list) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        deduped.push(g);
      }

      setLinkedGuardians(deduped);
    } catch (err: unknown) {
      setGuardianError(getErrorMessage(err) ?? "Failed to load approved guardians.");
      setLinkedGuardians([]);
    } finally {
      setLoadingGuardians(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!open) return;
      if (!childId) return;

      setError(null);
      setGuardianError(null);
      setSearchError(null);
      setSearchResults([]);
      setSearch("");
      setCreateGuardianOpen(false);

      setLoading(true);

      try {
        if (!supabase) throw new Error("Missing Supabase env vars.");

        const { data, error } = await supabase
          .from("children")
          .select("id, first_name, last_name, dob, allergies, medical_notes, notes")
          .eq("id", childId)
          .single();

        if (error) throw error;
        if (cancelled) return;

        setFirstName((data?.first_name ?? "") as string);
        setLastName((data?.last_name ?? "") as string);
        setDob((data?.dob ?? "") as string);

        setAllergies((data?.allergies ?? "") as string);
        setMedicalNotes((data?.medical_notes ?? "") as string);
        setNotes((data?.notes ?? "") as string);

        await loadLinkedGuardians(childId);
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

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      setSearchError(null);
      setSearchResults([]);

      if (!open) return;
      if (!childId) return;

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
          .select("id, first_name, last_name, full_name, relationship, phone, active")
          .eq("active", true)
          .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
          .order("full_name", { ascending: true })
          .limit(25);

        if (error) throw error;
        if (cancelled) return;

        const linkedIds = new Set(linkedGuardians.map((g) => g.id));
        const list = ((data ?? []) as GuardianRow[]).filter((g) => !linkedIds.has(g.id));

        setSearchResults(list);
      } catch (err: unknown) {
        if (cancelled) return;
        setSearchError(getErrorMessage(err) ?? "Search failed.");
        setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }

    runSearch();
    return () => {
      cancelled = true;
    };
  }, [open, childId, trimmedSearch, linkedGuardians]);

  async function linkGuardian(guardianId: string) {
    if (!childId) return;

    setGuardianError(null);
    setLinking(true);

    try {
      if (!supabase) throw new Error("Missing Supabase env vars.");

      const { data: existing, error: existingErr } = await supabase
        .from("child_guardians")
        .select("child_id, guardian_id")
        .eq("child_id", childId)
        .eq("guardian_id", guardianId)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existing) {
        const { error: upErr } = await supabase
          .from("child_guardians")
          .update({ active: true })
          .eq("child_id", childId)
          .eq("guardian_id", guardianId);

        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from("child_guardians").insert({
          child_id: childId,
          guardian_id: guardianId,
          active: true,
        });

        if (insErr) throw insErr;
      }

      await loadLinkedGuardians(childId);
      setSearch("");
      setSearchResults([]);
    } catch (err: unknown) {
      setGuardianError(getErrorMessage(err) ?? "Failed to link guardian.");
    } finally {
      setLinking(false);
    }
  }

  async function unlinkGuardian(guardianId: string) {
    if (!childId) return;

    setGuardianError(null);
    setLinking(true);

    try {
      if (!supabase) throw new Error("Missing Supabase env vars.");

      const { error } = await supabase
        .from("child_guardians")
        .update({ active: false })
        .eq("child_id", childId)
        .eq("guardian_id", guardianId);

      if (error) throw error;

      await loadLinkedGuardians(childId);
    } catch (err: unknown) {
      setGuardianError(getErrorMessage(err) ?? "Failed to unlink guardian.");
    } finally {
      setLinking(false);
    }
  }

  async function handleGuardianCreatedInline(g: GuardianInlineRow) {
    if (!childId) return;

    setGuardianError(null);
    setLinking(true);
    try {
      if (!supabase) throw new Error("Missing Supabase env vars.");

      const { error } = await supabase.from("child_guardians").insert({
        child_id: childId,
        guardian_id: g.id,
        active: true,
      });

      if (error) throw error;

      setCreateGuardianOpen(false);
      await loadLinkedGuardians(childId);
    } catch (err: unknown) {
      setGuardianError(getErrorMessage(err) ?? "Failed to link new guardian.");
    } finally {
      setLinking(false);
    }
  }

  async function handleSave() {
    if (!open) return;
    if (!childId) return;

    setError(null);

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
      const payload: {
        first_name: string;
        last_name: string;
        dob: string;
        allergies: string | null;
        medical_notes: string | null;
        notes: string | null;
      } = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob: dob.trim(),
        allergies: allergies.trim().length > 0 ? allergies.trim() : null,
        medical_notes: medicalNotes.trim().length > 0 ? medicalNotes.trim() : null,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      };

      const { error } = await supabase.from("children").update(payload).eq("id", childId);

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

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-4">
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
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    First name *
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Last name *
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
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
                  value={dob ?? ""}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Allergies
                </label>
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Nuts, dairy"
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Medical notes
                </label>
                <textarea
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  className="w-full min-h-[90px] rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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

                {loadingGuardians ? (
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">Loading guardians…</p>
                  </div>
                ) : linkedGuardians.length === 0 ? (
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">
                      No guardians linked yet.
                    </p>
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
                            {g.relationship ? ` • ${g.relationship}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => unlinkGuardian(g.id)}
                          disabled={linking}
                          className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                        onClick={() => linkGuardian(g.id)}
                        disabled={linking}
                        className="w-full px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {g.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-slate-600">
                          {g.phone ? g.phone : "Phone —"}
                          {g.relationship ? ` • ${g.relationship}` : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Tap to add as approved guardian
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
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
