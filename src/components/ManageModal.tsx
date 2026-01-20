"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import EditChildModal from "@/components/EditChildModal";
import EditGuardianModal from "@/components/EditGuardianModal";

type ManageModalProps = {
  open: boolean;
  onClose: () => void;
};

type ChildRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  active: boolean | null;
};

type GuardianRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
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

export default function ManageModal({ open, onClose }: ManageModalProps) {
  const [tab, setTab] = useState<"children" | "guardians">("children");

  const [childSearch, setChildSearch] = useState("");
  const trimmedChildSearch = useMemo(() => childSearch.trim(), [childSearch]);
  const [childResults, setChildResults] = useState<ChildRow[]>([]);
  const [childSearching, setChildSearching] = useState(false);
  const [childError, setChildError] = useState<string | null>(null);

  const [guardianSearch, setGuardianSearch] = useState("");
  const trimmedGuardianSearch = useMemo(
    () => guardianSearch.trim(),
    [guardianSearch]
  );
  const [guardianResults, setGuardianResults] = useState<GuardianRow[]>([]);
  const [guardianSearching, setGuardianSearching] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);

  const [editChildOpen, setEditChildOpen] = useState(false);
  const [editChildId, setEditChildId] = useState<string | null>(null);

  const [editGuardianOpen, setEditGuardianOpen] = useState(false);
  const [editGuardianId, setEditGuardianId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setTab("children");

    setChildSearch("");
    setChildResults([]);
    setChildError(null);

    setGuardianSearch("");
    setGuardianResults([]);
    setGuardianError(null);

    setEditChildOpen(false);
    setEditChildId(null);

    setEditGuardianOpen(false);
    setEditGuardianId(null);
  }, [open]);

  useEffect(() => {
    let cancelled = false;

    async function runChildSearch() {
      setChildError(null);
      setChildResults([]);

      if (!open) return;
      if (tab !== "children") return;

      if (!supabase) {
        setChildError("Missing Supabase env vars.");
        return;
      }

      if (trimmedChildSearch.length < 2) return;

      setChildSearching(true);
      try {
        const q = trimmedChildSearch.replace(/%/g, "\\%").replace(/_/g, "\\_");
        const pattern = `%${q}%`;

        const { data, error } = await supabase
          .from("children")
          .select("id, first_name, last_name, dob, active")
          .eq("active", true)
          .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
          .order("last_name", { ascending: true })
          .limit(30);

        if (error) throw error;
        if (cancelled) return;

        setChildResults((data ?? []) as ChildRow[]);
      } catch (err: unknown) {
        if (cancelled) return;
        setChildError(getErrorMessage(err) ?? "Search failed.");
        setChildResults([]);
      } finally {
        if (!cancelled) setChildSearching(false);
      }
    }

    runChildSearch();
    return () => {
      cancelled = true;
    };
  }, [open, tab, trimmedChildSearch]);

  useEffect(() => {
    let cancelled = false;

    async function runGuardianSearch() {
      setGuardianError(null);
      setGuardianResults([]);

      if (!open) return;
      if (tab !== "guardians") return;

      if (!supabase) {
        setGuardianError("Missing Supabase env vars.");
        return;
      }

      if (trimmedGuardianSearch.length < 2) return;

      setGuardianSearching(true);
      try {
        const q = trimmedGuardianSearch.replace(/%/g, "\\%").replace(/_/g, "\\_");
        const pattern = `%${q}%`;

        const { data, error } = await supabase
          .from("guardians")
          .select("id, first_name, last_name, full_name, phone, active")
          .eq("active", true)
          .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
          .order("full_name", { ascending: true })
          .limit(30);

        if (error) throw error;
        if (cancelled) return;

        setGuardianResults((data ?? []) as GuardianRow[]);
      } catch (err: unknown) {
        if (cancelled) return;
        setGuardianError(getErrorMessage(err) ?? "Search failed.");
        setGuardianResults([]);
      } finally {
        if (!cancelled) setGuardianSearching(false);
      }
    }

    runGuardianSearch();
    return () => {
      cancelled = true;
    };
  }, [open, tab, trimmedGuardianSearch]);

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
            <p className="text-sm font-semibold text-slate-900">Manage</p>
            <p className="text-xs text-slate-500">
              Search and edit children + guardians
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("children")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                tab === "children"
                  ? "bg-teal-950 text-white border-teal-950"
                  : "bg-white text-slate-700"
              }`}
            >
              Children
            </button>
            <button
              type="button"
              onClick={() => setTab("guardians")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                tab === "guardians"
                  ? "bg-teal-950 text-white border-teal-950"
                  : "bg-white text-slate-700"
              }`}
            >
              Guardians
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 pb-4 space-y-3">
          {tab === "children" ? (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Search children
                </label>
                <input
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                  placeholder="Type name…"
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
              </div>

              {childError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {childError}
                </div>
              ) : null}

              {childSearching ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">Searching…</p>
                </div>
              ) : trimmedChildSearch.length >= 2 && childResults.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">No matches found.</p>
                </div>
              ) : childResults.length === 0 ? null : (
                <div className="divide-y rounded-xl border">
                  {childResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setEditChildId(c.id);
                        setEditChildOpen(true);
                      }}
                      className="w-full px-3 py-3 text-left hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {(c.first_name ?? "").trim()} {(c.last_name ?? "").trim()}
                      </p>
                      <p className="text-xs text-slate-600">Tap to edit</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Search guardians
                </label>
                <input
                  value={guardianSearch}
                  onChange={(e) => setGuardianSearch(e.target.value)}
                  placeholder="Type name or phone…"
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-900/20"
                />
              </div>

              {guardianError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {guardianError}
                </div>
              ) : null}

              {guardianSearching ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">Searching…</p>
                </div>
              ) : trimmedGuardianSearch.length >= 2 &&
                guardianResults.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">No matches found.</p>
                </div>
              ) : guardianResults.length === 0 ? null : (
                <div className="divide-y rounded-xl border">
                  {guardianResults.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setEditGuardianId(g.id);
                        setEditGuardianOpen(true);
                      }}
                      className="w-full px-3 py-3 text-left hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {g.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-600">
                        {g.phone ? g.phone : "Phone —"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Tap to edit
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-900"
          >
            Close
          </button>
        </div>
      </div>

      <EditChildModal
        open={editChildOpen}
        childId={editChildId}
        onClose={() => {
          setEditChildOpen(false);
          setEditChildId(null);
        }}
        onUpdated={() => {
          setEditChildOpen(false);
          setEditChildId(null);
        }}
      />

      <EditGuardianModal
        open={editGuardianOpen}
        guardianId={editGuardianId}
        onClose={() => {
          setEditGuardianOpen(false);
          setEditGuardianId(null);
        }}
        onUpdated={() => {
          setEditGuardianOpen(false);
          setEditGuardianId(null);
        }}
      />
    </div>
  );
}
