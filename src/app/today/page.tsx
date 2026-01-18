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
  family_key: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  allergies: string | null;
  medical_notes: string | null;
  notes: string | null;
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

export default function TodayPage() {
  const router = useRouter();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);

  const [query, setQuery] = useState("");
  const trimmedQuery = useMemo(() => query.trim(), [query]);

  const [results, setResults] = useState<ChildRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSearchError(null);

      if (!checkInOpen) {
        setResults([]);
        return;
      }

      if (!supabase) {
        setSearchError("Missing Supabase env vars.");
        setResults([]);
        return;
      }

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
          .select(
            "id,first_name,last_name,dob,family_key,parent_name,parent_phone,allergies,medical_notes,notes,active"
          )
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
  }, [checkInOpen, trimmedQuery]);

  function handleSelectChild(_child: ChildRow) {
    // Next step will do actual check-in (attendance insert).
    setCheckInOpen(false);
    setQuery("");
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
        onClose={() => setCheckInOpen(false)}
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
                  onClick={() => handleSelectChild(c)}
                  className="w-full px-3 py-3 text-left hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-xs text-slate-600">
                    {c.parent_phone ? `Parent: ${c.parent_phone}` : "Parent: —"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </CheckInModal>

      <CreateChildModal
        open={createChildOpen}
        onClose={() => setCreateChildOpen(false)}
        onCreated={() => {
          // Keep the user in the check-in flow; they can immediately search for the new record.
        }}
      />
    </main>
  );
}
