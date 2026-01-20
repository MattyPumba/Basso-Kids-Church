"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type GuardianRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  active: boolean | null;
};

type NewGuardianState = {
  first_name: string;
  last_name: string;
  phone: string;
  approved_by_name: string;
  approved_by_method: "call" | "sms" | "in_person";
};

const initialGuardianState: NewGuardianState = {
  first_name: "",
  last_name: "",
  phone: "",
  approved_by_name: "",
  approved_by_method: "in_person",
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

function isDuplicateConstraint(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string };
  if (e?.code === "23505") return true;
  const msg = `${e?.message ?? ""} ${e?.details ?? ""}`.toLowerCase();
  return msg.includes("duplicate") && msg.includes("unique");
}

type CreateGuardianInlineProps = {
  initialName?: string;
  onCreated: (guardian: GuardianRow) => void;
  disabled?: boolean;
};

function splitName(initialName?: string): { first: string; last: string } {
  const raw = (initialName ?? "").trim();
  if (!raw) return { first: "", last: "" };

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: "" };

  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return { first, last };
}

export default function CreateGuardianInline({
  initialName,
  onCreated,
  disabled,
}: CreateGuardianInlineProps) {
  const prefill = useMemo(() => splitName(initialName), [initialName]);

  const [form, setForm] = useState<NewGuardianState>({
    ...initialGuardianState,
    first_name: prefill.first,
    last_name: prefill.last,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(
    () => form.first_name.trim().length > 0 && form.phone.trim().length > 0,
    [form.first_name, form.phone]
  );

  async function handleCreate() {
    setError(null);
    if (disabled) return;

    if (!supabase) {
      setError("Missing Supabase env vars.");
      return;
    }

    if (!form.first_name.trim()) {
      setError("First name is required.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Phone is required (used to prevent duplicates).");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        phone: form.phone.trim() || null,
        approved_by_name: form.approved_by_name.trim() || null,
        approved_by_method: form.approved_by_method,
        approved_at: new Date().toISOString(),
        active: true,
      };

      const { data, error } = await supabase
        .from("guardians")
        .insert(payload)
        .select("id,first_name,last_name,full_name,phone,active")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Guardian insert did not return data.");

      onCreated(data as GuardianRow);
      setForm(initialGuardianState);
    } catch (err: unknown) {
      if (isDuplicateConstraint(err)) {
        setError(
          "That guardian already exists (same first name, last name, and phone)."
        );
      } else {
        setError(getErrorMessage(err) ?? "Failed to create guardian.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-3 space-y-3">
      <p className="text-xs font-semibold text-slate-700">Create guardian</p>

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
            disabled={disabled || saving}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Last name</label>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, last_name: e.target.value }))
            }
            className="w-full rounded-xl border px-3 py-2 text-sm"
            disabled={disabled || saving}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">Phone *</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          disabled={disabled || saving}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Approved by
          </label>
          <input
            type="text"
            value={form.approved_by_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, approved_by_name: e.target.value }))
            }
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Name"
            disabled={disabled || saving}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Approved via
          </label>
          <select
            value={form.approved_by_method}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                approved_by_method: e.target.value as "call" | "sms" | "in_person",
              }))
            }
            className="w-full rounded-xl border px-3 py-2 text-sm"
            disabled={disabled || saving}
          >
            <option value="call">call</option>
            <option value="sms">sms</option>
            <option value="in_person">in_person</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border bg-slate-50 p-3">
        <p className="text-[11px] text-slate-600">
          Relationship is now set per child on{" "}
          <span className="font-mono">child_guardians.relationship</span>.
        </p>
      </div>

      <button
        type="button"
        onClick={handleCreate}
        disabled={!canCreate || saving || disabled}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create guardian"}
      </button>
    </div>
  );
}
