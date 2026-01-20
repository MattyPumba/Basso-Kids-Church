"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CheckInModal from "@/components/CheckInModal";
import CheckOutModal from "@/components/CheckOutModal";
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

type GroupKey = "KINDY_PREPRIMARY" | "YEARS_1_3" | "YEARS_4_6";

type CheckedInRow = {
  attendance_id: string;
  child_id: string;
  group_key: GroupKey;
  check_in_time: string;
  check_out_time: string | null;
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type JoinedChildObject = {
  id: string;
  first_name: string;
  last_name: string;
};

function normalizeJoinedChild(
  child: JoinedChildObject | JoinedChildObject[] | null | undefined
): JoinedChildObject[] | null {
  if (!child) return null;
  if (Array.isArray(child)) return child;
  return [child];
}

function groupLabel(key: GroupKey): string {
  if (key === "KINDY_PREPRIMARY") return "KINDY – PRE-PRIMARY";
  if (key === "YEARS_1_3") return "YEARS 1 – 3";
  return "YEARS 4 – 6";
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function nextOrSameSunday(from: Date): Date {
  const d = startOfDayLocal(from);
  const day = d.getDay(); // 0 = Sunday
  const add = (7 - day) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + add);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function formatSundayLabel(d: Date): string {
  return d.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// WA bucket logic: age as at 30 June of current year
function ageOnJune30ThisYear(dobISO: string | null): number | null {
  if (!dobISO) return null;
  const dob = new Date(dobISO);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  const cutoff = new Date(now.getFullYear(), 5, 30); // June is month 5 (0-indexed)

  let age = cutoff.getFullYear() - dob.getFullYear();
  const m = cutoff.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < dob.getDate())) age -= 1;

  return age;
}

function groupKeyForAgeOnJune30(ageYears: number | null): GroupKey {
  if (ageYears === null) return "YEARS_1_3";
  if (ageYears <= 5) return "KINDY_PREPRIMARY";
  if (ageYears <= 8) return "YEARS_1_3";
  return "YEARS_4_6";
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

  // Auth visibility
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Sunday service date picker (always Sundays)
  const [serviceSunday, setServiceSunday] = useState<Date>(() =>
    nextOrSameSunday(new Date())
  );
  const serviceDateISO = useMemo(() => toISODate(serviceSunday), [serviceSunday]);

  // List state
  const [checkedIn, setCheckedIn] = useState<CheckedInRow[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [todayError, setTodayError] = useState<string | null>(null);

  // Checkout state
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [checkOutTarget, setCheckOutTarget] = useState<CheckedInRow | null>(null);
  const [checkOutGuardians, setCheckOutGuardians] = useState<GuardianRow[]>([]);
  const [loadingCheckOutGuardians, setLoadingCheckOutGuardians] = useState(false);
  const [checkOutError, setCheckOutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [createPickupOpen, setCreatePickupOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let unsub: { unsubscribe: () => void } | null = null;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setAuthError(error.message);
          setAuthEmail(null);
          setAuthLoading(false);
          return;
        }

        const email = data.session?.user?.email ?? null;
        setAuthEmail(email);
        setAuthLoading(false);

        if (!data.session) router.replace("/login");
      })
      .catch((err: unknown) => {
        setAuthError(getErrorMessage(err));
        setAuthEmail(null);
        setAuthLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setAuthEmail(email);

      if (!session) router.replace("/login");
    });

    unsub = data.subscription;

    return () => {
      unsub?.unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    if (!supabase) return;

    setAuthError(null);
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setAuthEmail(null);
      router.replace("/login");
    } catch (err: unknown) {
      setAuthError(getErrorMessage(err) ?? "Failed to log out.");
    } finally {
      setLoggingOut(false);
    }
  }

  async function loadToday(forServiceDateISO: string) {
    setTodayError(null);

    if (!supabase) {
      setTodayError("Missing Supabase env vars.");
      setCheckedIn([]);
      return;
    }

    setLoadingToday(true);
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          id,
          child_id,
          group_key,
          check_in_time,
          check_out_time,
          child:children (
            id,
            first_name,
            last_name
          )
        `
        )
        .eq("service_date", forServiceDateISO)
        .order("check_in_time", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        child_id: string;
        group_key: GroupKey;
        check_in_time: string;
        check_out_time: string | null;
        child: JoinedChildObject | JoinedChildObject[] | null;
      }>;

      setCheckedIn(
        rows.map((r) => ({
          attendance_id: r.id,
          child_id: r.child_id,
          group_key: r.group_key,
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time,
          children: normalizeJoinedChild(r.child),
        }))
      );
    } catch (err: unknown) {
      setTodayError(getErrorMessage(err) ?? "Failed to load list.");
      setCheckedIn([]);
    } finally {
      setLoadingToday(false);
    }
  }

  useEffect(() => {
    loadToday(serviceDateISO);
  }, [serviceDateISO]);

  function stepSunday(direction: "prev" | "next") {
    const delta = direction === "prev" ? -7 : 7;
    setServiceSunday((d) => addDays(d, delta));
  }

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
        .select("id, first_name, last_name, full_name, relationship, phone, active")
        .in("id", ids);

      if (gErr) throw gErr;

      const list = ((gs ?? []) as GuardianRow[]).filter((g) => g.active !== false);

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
      const age = ageOnJune30ThisYear(selectedChild.dob);
      const group_key = groupKeyForAgeOnJune30(age);

      const nowIso = new Date().toISOString();

      const { error } = await supabase.from("attendance").insert({
        child_id: selectedChild.id,
        service_date: serviceDateISO,
        group_key,
        check_in_time: nowIso,
        checked_in_by_guardian_id: guardian.id,
      });

      if (error) throw error;

      await loadToday(serviceDateISO);

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

  async function loadCheckoutGuardiansForChild(childId: string) {
    setCheckOutError(null);
    setCheckOutGuardians([]);

    if (!supabase) {
      setCheckOutError("Missing Supabase env vars.");
      return;
    }

    setLoadingCheckOutGuardians(true);
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
        setCheckOutGuardians([]);
        return;
      }

      const { data: gs, error: gErr } = await supabase
        .from("guardians")
        .select("id, first_name, last_name, full_name, relationship, phone, active")
        .in("id", ids);

      if (gErr) throw gErr;

      const list = ((gs ?? []) as GuardianRow[]).filter((g) => g.active !== false);

      const seen = new Set<string>();
      const deduped: GuardianRow[] = [];
      for (const g of list) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        deduped.push(g);
      }

      setCheckOutGuardians(deduped);
    } catch (err: unknown) {
      setCheckOutError(getErrorMessage(err) ?? "Failed to load guardians.");
      setCheckOutGuardians([]);
    } finally {
      setLoadingCheckOutGuardians(false);
    }
  }

  async function openCheckout(row: CheckedInRow) {
    setCheckOutError(null);
    setCreatePickupOpen(false);
    setCheckOutTarget(row);
    setCheckOutOpen(true);
    await loadCheckoutGuardiansForChild(row.child_id);
  }

  async function handlePickupGuardianCreated(g: GuardianInlineRow) {
    if (!checkOutTarget) return;

    setCheckOutError(null);
    setLinkingGuardian(true);
    try {
      await linkGuardianToChild(checkOutTarget.child_id, g.id);
      setCreatePickupOpen(false);
      await loadCheckoutGuardiansForChild(checkOutTarget.child_id);
    } catch (err: unknown) {
      setCheckOutError(getErrorMessage(err) ?? "Failed to link guardian.");
    } finally {
      setLinkingGuardian(false);
    }
  }

  async function completeCheckOut(pickupGuardian: GuardianRow) {
    setCheckOutError(null);

    if (!supabase) {
      setCheckOutError("Missing Supabase env vars.");
      return;
    }
    if (!checkOutTarget) return;

    setCheckingOut(true);
    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out_time: nowIso,
          checked_out_by_guardian_id: pickupGuardian.id,
        })
        .eq("id", checkOutTarget.attendance_id);

      if (error) throw error;

      await loadToday(serviceDateISO);

      setCheckOutOpen(false);
      setCheckOutTarget(null);
      setCheckOutGuardians([]);
      setCreatePickupOpen(false);
    } catch (err: unknown) {
      setCheckOutError(getErrorMessage(err) ?? "Check-out failed.");
    } finally {
      setCheckingOut(false);
    }
  }

  const grouped = useMemo(() => {
    const out: Record<GroupKey, CheckedInRow[]> = {
      KINDY_PREPRIMARY: [],
      YEARS_1_3: [],
      YEARS_4_6: [],
    };
    for (const r of checkedIn) out[r.group_key]?.push(r);
    return out;
  }, [checkedIn]);

  const groupOrder: GroupKey[] = ["KINDY_PREPRIMARY", "YEARS_1_3", "YEARS_4_6"];

  return (
    <main className="min-h-dvh bg-white">
      <header className="w-full bg-teal-950 text-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Kids Church Check-In</h1>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={!authEmail || loggingOut}
              className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>

          <div className="mt-2 text-xs opacity-90">
            {authLoading ? (
              <span>Checking login…</span>
            ) : authEmail ? (
              <span>Logged in as {authEmail}</span>
            ) : (
              <span>Not logged in</span>
            )}
          </div>

          {authError ? (
            <div className="mt-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-white">
              {authError}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => stepSunday("prev")}
            className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-700"
            aria-label="Previous Sunday"
          >
            ←
          </button>

          <div className="flex-1 rounded-xl border bg-white px-3 py-2 text-center">
            <p className="text-xs text-slate-500">Service date (Sunday)</p>
            <p className="text-sm font-semibold text-slate-900">
              {formatSundayLabel(serviceSunday)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => stepSunday("next")}
            className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-700"
            aria-label="Next Sunday"
          >
            →
          </button>
        </div>

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
          <div className="space-y-4">
            {groupOrder.map((g) => (
              <section key={g} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {groupLabel(g)}
                  </h2>
                  <span className="text-xs text-slate-500">0</span>
                </div>

                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">None</p>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {groupOrder.map((g) => (
              <section key={g} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {groupLabel(g)}
                  </h2>
                  <span className="text-xs text-slate-500">{grouped[g].length}</span>
                </div>

                {grouped[g].length === 0 ? (
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">None</p>
                  </div>
                ) : (
                  <div className="divide-y rounded-xl border">
                    {grouped[g].map((row) => {
                      const isCheckedOut = !!row.check_out_time;

                      return (
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
                              {isCheckedOut && row.check_out_time
                                ? ` • Checked out ${formatTime(row.check_out_time)}`
                                : ""}
                            </p>
                          </div>

                          {isCheckedOut ? (
                            <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                              Checked out
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => openCheckout(row)}
                            >
                              Check out
                            </button>
                          )}
                        </div>
                      );
                    })}
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
                  onClick={() => {
                    setSelectedChild(null);
                    setGuardians([]);
                    setGuardianError(null);
                    setCheckInError(null);
                    setCreateGuardianOpen(false);
                  }}
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

      <CheckOutModal
        open={checkOutOpen}
        onClose={() => {
          setCheckOutOpen(false);
          setCheckOutTarget(null);
          setCheckOutGuardians([]);
          setCheckOutError(null);
          setCreatePickupOpen(false);
        }}
        title="Check Out"
        subtitle="Select who picked up (must be an approved guardian)"
      >
        {checkOutError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {checkOutError}
          </div>
        ) : null}

        {checkOutTarget ? (
          <div className="rounded-xl border bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-900">
              {checkOutTarget.children && checkOutTarget.children.length > 0
                ? `${checkOutTarget.children[0].first_name} ${checkOutTarget.children[0].last_name}`
                : "Unknown child"}
            </p>
            <p className="text-xs text-slate-600">
              Checked in {formatTime(checkOutTarget.check_in_time)}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setCreatePickupOpen((v) => !v)}
            disabled={checkingOut || linkingGuardian}
            className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {createPickupOpen ? "Close" : "Add approved pickup"}
          </button>
        </div>

        {createPickupOpen ? (
          <CreateGuardianInline
            onCreated={handlePickupGuardianCreated}
            disabled={checkingOut || linkingGuardian}
          />
        ) : null}

        {loadingCheckOutGuardians ? (
          <div className="rounded-xl border bg-slate-50 p-3">
            <p className="text-sm text-slate-700">Loading guardians…</p>
          </div>
        ) : checkOutGuardians.length === 0 ? (
          <div className="rounded-xl border bg-slate-50 p-3">
            <p className="text-sm text-slate-700">
              No approved guardians are linked to this child yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Use “Add approved pickup” above to add one, then select them.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-xl border">
            {checkOutGuardians.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => completeCheckOut(g)}
                disabled={checkingOut || linkingGuardian}
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

        {checkingOut ? (
          <div className="rounded-xl border bg-slate-50 p-3">
            <p className="text-sm text-slate-700">Checking out…</p>
          </div>
        ) : null}
      </CheckOutModal>
    </main>
  );
}
