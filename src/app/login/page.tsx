"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Supabase is not configured (.env.local missing).");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/today");
  }

  return (
    <main className="min-h-dvh bg-white">
      <header className="w-full bg-teal-950 text-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-xl font-semibold">Kids Church Check-In</h1>
          <p className="text-sm opacity-90">Login</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 w-full rounded-xl bg-teal-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
