"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TodayPage() {
  const router = useRouter();

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
  }, [router]);

  const status = !supabase
    ? { label: "Not configured", message: "Add keys to .env.local" }
    : { label: "Connected", message: "Supabase connected" };

  return (
    <main className="min-h-dvh bg-white">
      <header className="w-full bg-teal-950 text-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-xl font-semibold">Kids Church Check-In</h1>
          <p className="text-sm opacity-90">Today</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">
            Status: <span className="font-medium">{status.label}</span>
          </p>
          <p className="mt-2 text-sm text-slate-600">{status.message}</p>
        </div>
      </div>
    </main>
  );
}
