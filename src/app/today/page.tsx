"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function TodayPage() {
  useEffect(() => {
    if (!supabase) {
      console.warn("Supabase not configured yet (.env.local missing).");
      return;
    }

    supabase
      .from("healthcheck")
      .select("*")
      .limit(1)
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase connection check:", error.message);
        } else {
          console.log("Supabase connection OK");
        }
      });
  }, []);

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
            Supabase: not configured yet. Add keys to <code>.env.local</code>.
          </p>
        </div>
      </div>
    </main>
  );
}
