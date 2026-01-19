"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CheckInModal from "@/components/CheckInModal";
import CreateChildModal from "@/components/CreateChildModal";
import CreateGuardianInline, {
  GuardianRow as GuardianInlineRow,
} from "@/components/CreateGuardianInline";

type ChildRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  active: boolean | null;
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

type CheckedInRow = {
  attendance_id: string;
  child_id: string;
  group_key: "LITTLE" | "MIDDLE" | "OLDER";
  check_in_time: string;
  // We keep this as an array because Supabase joins often return arrays
  children: {
    id: string;
    first_name: string;
    last_name: string;
  }[] | null;
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

function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

  const [createGuardianOpen, setCreateGuardianOpen] = useState(false);
  const [linkingGuardian, setLinkingGuardian] = useState(false);

  // Today list state
  const [checkedIn, setCheckedIn] = useState<CheckedInRow[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [todayError, setTodayError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [router]);

  async function loadToday() {
    setTodayError(null);

    if (!supabase) {
      setTodayError("Missing Supabase env vars.");
      setCheckedIn([]);
      return;
    }

    setLoadingToday(true);
    try {
      const serviceDate = todayISODate();

      // IMPORTANT FIX:
      // Use the confirmed FK relationship name: attendance_child_id_fkey
      // This makes the join stable so the child's name shows (no more "Unknown child").
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          id,
          child_id,
          group_key,
          check_in_time,
          child:children!attendance_child_id_fkey (
            id,
            first_name,
            last_name
          )
        `
        )
        .eq("service_date", serviceDate)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        child_id: string;
        group_key: "LITTLE" | "MIDDLE" | "OLDER";
        check_in_time: string;
        child: { id: string; first_name: string; last_name: string }[] | null;
      }>;

      setCheckedIn(
        rows.map((r) => ({
          attendance_id: r.id,
          child_id: r.child_id,
          group_key: r.group_key,
          check_in_time: r.check_in_time,
          // Keep CheckedInRow's property name as "children" to avoid touching UI code.
          children: r.child,
        }))
      );
    } catch (err: unknown) {
      setTodayError(getErrorMessage(err) ?? "Failed to load today list.");
      setCheckedIn([]);
    } finally {
      setLoadingToday(false);
    }
  }

  // Load Today list on mount
  useEffect(() => {
    loadToday();
  }, []);

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
        setCreateGuardianOpen(false);
        return;
      }

      if (!supabase) {
        setSearchError("Missing Supabase env vars.");
        setResults([]);
        return;
      }

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
          .select("id,first_name,last_name,dob,active")
          .eq("active", true)
          .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
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
      const { data: links, error: linkErr } = await supabase
        .from("child_guardians")
        .select("guardian_id")
        .eq("child_id", childId)
        .eq("active", true);

      if (linkErr) throw linkErr;

      const ids = (links ?? [])
        .map((r) => (r as { guardian_id: string | null }).guardian_id)
        .filter((id): id is string => !!id);

      if (ids.length === 0) {
        setGuardians([]);
        return;
      }

      const { data: gs, error: gErr } = await supabase
        .from("guardians")
        .select(
          "id, first_name, last_name, full_name, relationship, phone, active"
        )
        .in("id", ids as string[]);

      if (gErr) throw gErr;

      const list = ((gs ?? []) as GuardianRow[]).filter((g) => g.active !== false);

      // de-dupe by id
      const seen = new Set<string>();
      const deduped: GuardianRow[] = [];
      for (const g of list) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        deduped.push(g);
      }

      setGuardians(deduped);
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
    setGuardianError(null);
    setCreateGuardianOpen(false);
    await loadGuardiansForChild(child.id);
  }

  async function linkGuardianToChild(childId: string, guardianId: string) {
    if (!supabase) throw new Error("Missing Supabase env vars.");

    const { error } = await supabase.from("child_guardians").insert({
      child_id: childId,
      guardian_id: guardianId,
      active: true,
    });

    if (error) throw error;
  }

  async function handleGuardianCreated(g: GuardianInlineRow) {
    if (!selectedChild) return;

    setGuardianError(null);
    setLinkingGuardian(true);
    try {
      await linkGuardianToChild(selectedChild.id, g.id);
      setCreateGuardianOpen(false);
      await loadGuardiansForChild(selectedChild.id);
    } catch (err: unknown) {
      setGuardianError(getErrorMessage(err) ?? "Failed to link guardian.");
    } finally {
      setLinkingGuardian(false);
    }
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

      const nowIso = new Date().toISOString();

      const { error } = await supabase.from("attendance").insert({
        child_id: selectedChild.id,
        service_date: todayISODate(),
        group_key,
        check_in_time: nowIso,
        checked_in_by_guardian_id: guardian.id,
      });

      if (error) throw error;

      await loadToday();

      // reset modal state
      setCheckInOpen(false);
      setQuery("");
      setResults([]);
      setSelectedChild(null);
      setGuardians([]);
      setCreateGuardianOpen(false);
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
    setCreateGuardianOpen(false);
  }

  const grouped = useMemo(() => {
    const out: Record<"LITTLE" | "MIDDLE" | "OLDER", CheckedInRow[]> = {
      LITTLE: [],
      MIDDLE: [],
      OLDER: [],
    };
    for (const r of checkedIn) out[r.group_key]?.push(r);
    return out;
  }, [checkedIn]);

  return (
    <main className="min-h-dvh bg-white">
      <header className="w-full bg-teal-950 text-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-xl font-semibold">Kids Church Check-In</h1>
          <p className="text-sm opacity-90">Today</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6 space-y-4">
        {todayError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {todayError}
          </div>
        ) : null}

        {loadingToday ? (
          <div className="rounded-2xl border bg-white p-6 text-center">
            <p className="text-sm text-slate-700">Loading…</p>
          </div>
        ) : checkedIn.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-6 text-center">
            <p className="text-sm font-medium text-slate-700">
              No children checked in yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Use the button below to check a child in.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(["LITTLE", "MIDDLE", "OLDER"] as const).map((g) => (
              <section key={g} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">{g}</h2>
                  <span className="text-xs text-slate-500">
                    {grouped[g].length}
                  </span>
                </div>

                {grouped[g].length === 0 ? (
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">None</p>
                  </div>
                ) : (
                  <div className="divide-y rounded-xl border">
                    {grouped[g].map((row) => (
                      <div
                        key={row.attendance_id}
                        className="flex items-center justify-between gap-3 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {row.children && row.children.length > 0
                              ? `${row.children[0].first_name} ${row.children[0].last_name}`
                              : "Unknown child"}
                          </p>
                          <p className="text-xs text-slate-600">
                            Checked in {formatTime(row.check_in_time)}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            // Next step: open checkout modal
                          }}
                        >
                          Check out
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

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
          setCreateGuardianOpen(false);
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
                      <p className="text-xs text-slate-600">Tap to select</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">
                  {selectedChild.first_name} {selectedChild.last_name}
                </p>
                <p className="text-xs text-slate-600">
                  Select who is checking them in:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={backToSearch}
                  disabled={checkingIn || linkingGuardian}
                  className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setCreateGuardianOpen((v) => !v)}
                  disabled={checkingIn || linkingGuardian}
                  className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {createGuardianOpen ? "Close" : "Create guardian"}
                </button>
              </div>

              {createGuardianOpen ? (
                <CreateGuardianInline
                  onCreated={handleGuardianCreated}
                  disabled={checkingIn || linkingGuardian}
                />
              ) : null}

              {loadingGuardians ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">Loading guardians…</p>
                </div>
              ) : guardians.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">
                    No approved guardians are linked to this child yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {guardians.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => completeCheckIn(g)}
                      disabled={checkingIn || linkingGuardian}
                      className="w-full px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {g.full_name ?? "—"}
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
