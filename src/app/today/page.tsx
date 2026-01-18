"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CheckInModal from "@/components/CheckInModal";
import CreateChildModal from "@/components/CreateChildModal";

type ChildRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  parent_phone: string | null;
  active: boolean | null;
};

type GuardianRow = {
  id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  active: boolean | null;
};

type ChildGuardianJoinRow = {
  // When using supabase-js select with embedded relationship,
  // the embedded record often comes back as an array.
  guardian: GuardianRow[] | null;
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

function calculateAgeYears(dobISO: string | null): number | null {
  if (!dobISO) return null;
  const dob = new Date(dobISO);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

function groupKeyForAge(ageYears: number | null): "LITTLE" | "MIDDLE" | "OLDER" {
  if (ageYears === null) return "MIDDLE";
  if (ageYears <= 4) return "LITTLE";
  if (ageYears <= 10) return "MIDDLE";
  return "OLDER";
}

export default function TodayPage() {
  const router = useRouter();

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);

  const [query, setQuery] = useState("");
  const trimmedQuery = useMemo(() => query.trim(), [query]);

  const [results, setResults] = useState<ChildRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedChild, setSelectedChild] = useState<ChildRow | null>(null);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);

  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [router]);

  // Search children while in search step
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSearchError(null);
      setCheckInError(null);

      if (!checkInOpen) {
        setResults([]);
        setSelectedChild(null);
        setGuardians([]);
        return;
      }

      if (!supabase) {
        setSearchError("Missing Supabase env vars.");
        setResults([]);
        return;
      }

      // If we've selected a child, we're not in search step anymore
      if (selectedChild) return;

      if (trimmedQuery.length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        const q = trimmedQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");
        const pattern = `%${q}%`;

        const { data, error } = await supabase
          .from("children")
          .select("id,first_name,last_name,dob,parent_phone,active")
          .eq("active", true)
          .or(
            `first_name.ilike.${pattern},last_name.ilike.${pattern},parent_phone.ilike.${pattern}`
          )
          .order("last_name", { ascending: true })
          .limit(20);

        if (error) throw error;
        if (cancelled) return;

        setResults((data ?? []) as ChildRow[]);
      } catch (err: unknown) {
        if (cancelled) return;
        setSearchError(getErrorMessage(err) ?? "Search failed.");
        setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [checkInOpen, trimmedQuery, selectedChild]);

  async function loadGuardiansForChild(childId: string) {
    setGuardianError(null);
    setGuardians([]);

    if (!supabase) {
      setGuardianError("Missing Supabase env vars.");
      return;
    }

    setLoadingGuardians(true);
    try {
      // Join via child_guardians → guardians
      // NOTE: Supabase embedded relationship commonly returns an array
      const { data, error } = await supabase
        .from("child_guardians")
        .select(
          "guardian:guardian_id (id, full_name, relationship, phone, active)"
        )
        .eq("child_id", childId)
        .eq("active", true);

      if (error) throw error;

      const rows = (data ?? []) as ChildGuardianJoinRow[];

      const list = rows
        .map((r) => (r.guardian && r.guardian.length > 0 ? r.guardian[0] : null))
        .filter((g): g is GuardianRow => !!g)
        .filter((g) => g.active !== false);

      setGuardians(list);
    } catch (err: unknown) {
      setGuardianError(getErrorMessage(err) ?? "Failed to load guardians.");
      setGuardians([]);
    } finally {
      setLoadingGuardians(false);
    }
  }

  async function startGuardianStep(child: ChildRow) {
    setSelectedChild(child);
    setCheckInError(null);
    await loadGuardiansForChild(child.id);
  }

  async function completeCheckIn(guardian: GuardianRow) {
    setCheckInError(null);

    if (!supabase) {
      setCheckInError("Missing Supabase env vars.");
      return;
    }
    if (!selectedChild) return;

    setCheckingIn(true);
    try {
      const age = calculateAgeYears(selectedChild.dob);
      const group_key = groupKeyForAge(age);

      const { error } = await supabase.from("attendance").insert({
        child_id: selectedChild.id,
        group_key,
        checked_in_at: new Date().toISOString(),
        checked_in_by_guardian_id: guardian.id,
      });

      if (error) throw error;

      // reset modal state
      setCheckInOpen(false);
      setQuery("");
      setResults([]);
      setSelectedChild(null);
      setGuardians([]);
    } catch (err: unknown) {
      setCheckInError(getErrorMessage(err) ?? "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  }

  function backToSearch() {
    setSelectedChild(null);
    setGuardians([]);
    setGuardianError(null);
    setCheckInError(null);
  }

  return (
    <main className="min-h-dvh bg-white">
      <header className="w-full bg-teal-950 text-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-xl font-semibold">Kids Church Check-In</h1>
          <p className="text-sm opacity-90">Today</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-dashed bg-white p-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            No children checked in yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Use the button below to check a child in.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCheckInOpen(true)}
          className="w-full rounded-xl bg-teal-950 px-4 py-3 text-sm font-medium text-white"
        >
          Check In Child
        </button>
      </div>

      <CheckInModal
        open={checkInOpen}
        onClose={() => {
          setCheckInOpen(false);
          setSelectedChild(null);
          setGuardians([]);
          setGuardianError(null);
          setCheckInError(null);
        }}
        query={query}
        onQueryChange={setQuery}
        onNewChild={() => setCreateChildOpen(true)}
      >
        <div className="space-y-2">
          {searchError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {searchError}
            </div>
          ) : null}

          {guardianError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {guardianError}
            </div>
          ) : null}

          {checkInError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {checkInError}
            </div>
          ) : null}

          {!selectedChild ? (
            <>
              {trimmedQuery.length < 2 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">
                    Type at least 2 characters to search.
                  </p>
                </div>
              ) : searching ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">Searching…</p>
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">No matches found.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use “New child” if they’re not in the system yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => startGuardianStep(c)}
                      className="w-full px-3 py-3 text-left hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {c.parent_phone
                          ? `Parent: ${c.parent_phone}`
                          : "Parent: —"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">
                  {selectedChild.first_name} {selectedChild.last_name}
                </p>
                <p className="text-xs text-slate-600">
                  Select who is checking them in:
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={backToSearch}
                  disabled={checkingIn}
                  className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
                >
                  Back
                </button>
              </div>

              {loadingGuardians ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">Loading guardians…</p>
                </div>
              ) : guardians.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">
                    No approved guardians are linked to this child yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Next step: we’ll add an “Add guardian” action here.
                  </p>
                </div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {guardians.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => completeCheckIn(g)}
                      disabled={checkingIn}
                      className="w-full px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {g.full_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {g.relationship ? g.relationship : "—"}
                        {g.phone ? ` • ${g.phone}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CheckInModal>

      <CreateChildModal
        open={createChildOpen}
        onClose={() => setCreateChildOpen(false)}
        onCreated={() => {
          // stays simple for now
        }}
      />
    </main>
  );
}
