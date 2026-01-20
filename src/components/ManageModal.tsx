"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import EditChildModal from "@/components/EditChildModal";
import EditGuardianModal from "@/components/EditGuardianModal";

type TabKey = "children" | "guardians";

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

type ManageModalProps = {
  open: boolean;
  onClose: () => void;
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

export default function ManageModal({ open, onClose }: ManageModalProps) {
  const [tab, setTab] = useState<TabKey>("children");

  const [childQuery, setChildQuery] = useState("");
  const [guardianQuery, setGuardianQuery] = useState("");

  const trimmedChildQuery = useMemo(() => childQuery.trim(), [childQuery]);
  const trimmedGuardianQuery = useMemo(() => guardianQuery.trim(), [guardianQuery]);

  const [childResults, setChildResults] = useState<ChildRow[]>([]);
  const [guardianResults, setGuardianResults] = useState<GuardianRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editChildId, setEditChildId] = useState<string | null>(null);
  const [editGuardianId, setEditGuardianId] = useState<string | null>(null);

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

    setTab("children");
    setChildQuery("");
    setGuardianQuery("");
    setChildResults([]);
    setGuardianResults([]);
    setError(null);
    setLoading(false);
    setEditChildId(null);
    setEditGuardianId(null);
  }, [open]);

  const runChildrenSearch = useCallback(
    async (query: string) => {
      setError(null);

      if (!supabase) {
        setError("Missing Supabase env vars.");
        setChildResults([]);
        return;
      }

      if (query.trim().length < 2) {
        setChildResults([]);
        return;
      }

      setLoading(true);
      try {
        const q = query.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
        const pattern = `%${q}%`;

        const { data, error } = await supabase
          .from("children")
          .select("id,first_name,last_name,dob,active")
          .eq("active", true)
          .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
          .order("last_name", { ascending: true })
          .limit(25);

        if (error) throw error;

        setChildResults((data ?? []) as ChildRow[]);
      } catch (err: unknown) {
        setError(getErrorMessage(err) ?? "Search failed.");
        setChildResults([]);
      } finally {
        setLoading(false);
      }
    },
    [setChildResults]
  );

  const runGuardiansSearch = useCallback(
    async (query: string) => {
      setError(null);

      if (!supabase) {
        setError("Missing Supabase env vars.");
        setGuardianResults([]);
        return;
      }

      if (query.trim().length < 2) {
        setGuardianResults([]);
        return;
      }

      setLoading(true);
      try {
        const q = query.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
        const pattern = `%${q}%`;

        const { data, error } = await supabase
          .from("guardians")
          .select("id,first_name,last_name,full_name,relationship,phone,active")
          .eq("active", true)
          .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
          .order("full_name", { ascending: true })
          .limit(25);

        if (error) throw error;

        setGuardianResults((data ?? []) as GuardianRow[]);
      } catch (err: unknown) {
        setError(getErrorMessage(err) ?? "Search failed.");
        setGuardianResults([]);
      } finally {
        setLoading(false);
      }
    },
    [setGuardianResults]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!open) return;
      if (tab !== "children") return;

      try {
        await runChildrenSearch(trimmedChildQuery);
      } catch {
        // handled
      }

      if (cancelled) return;
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [open, tab, trimmedChildQuery, runChildrenSearch]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!open) return;
      if (tab !== "guardians") return;

      try {
        await runGuardiansSearch(trimmedGuardianQuery);
      } catch {
        // handled
      }

      if (cancelled) return;
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [open, tab, trimmedGuardianQuery, runGuardiansSearch]);

  if (!open) return null;

  const activeQuery = tab === "children" ? childQuery : guardianQuery;
  const setActiveQuery = tab === "children" ? setChildQuery : setGuardianQuery;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-2"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md rounded-2xl bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Manage</p>
              <p className="text-xs text-slate-500">Edit child or guardian details</p>
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTab("children")}
                className={
                  tab === "children"
                    ? "flex-1 rounded-xl bg-teal-950 px-3 py-2 text-xs font-semibold text-white"
                    : "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700"
                }
              >
                Children
              </button>
              <button
                type="button"
                onClick={() => setTab("guardians")}
                className={
                  tab === "guardians"
                    ? "flex-1 rounded-xl bg-teal-950 px-3 py-2 text-xs font-semibold text-white"
                    : "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700"
                }
              >
                Guardians
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Search {tab === "children" ? "children" : "guardians"}
              </label>
              <input
                value={activeQuery}
                onChange={(e) => setActiveQuery(e.target.value)}
                placeholder={tab === "children" ? "Name…" : "Name or phone…"}
                className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
              />
              <p className="text-[11px] text-slate-500">Type at least 2 characters.</p>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm text-slate-700">Searching…</p>
              </div>
            ) : tab === "children" ? (
              childResults.length === 0 && trimmedChildQuery.length >= 2 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">No matches found.</p>
                </div>
              ) : childResults.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">Search to begin.</p>
                </div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {childResults.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="text-xs text-slate-600">
                          {c.dob ? `DOB ${c.dob}` : "DOB —"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => setEditChildId(c.id)}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : guardianResults.length === 0 && trimmedGuardianQuery.length >= 2 ? (
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm text-slate-700">No matches found.</p>
              </div>
            ) : guardianResults.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-sm text-slate-700">Search to begin.</p>
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {guardianResults.map((g) => (
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
                      className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setEditGuardianId(g.id)}
                    >
                      Edit
                    </button>
                  </div>
                ))}
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

      <EditChildModal
        open={!!editChildId}
        childId={editChildId}
        onClose={() => setEditChildId(null)}
        onUpdated={async () => {
          if (tab === "children") {
            await runChildrenSearch(childQuery);
          }
        }}
      />

      <EditGuardianModal
        open={!!editGuardianId}
        guardianId={editGuardianId}
        onClose={() => setEditGuardianId(null)}
        onUpdated={async () => {
          if (tab === "guardians") {
            await runGuardiansSearch(guardianQuery);
          }
        }}
      />
    </>
  );
}
