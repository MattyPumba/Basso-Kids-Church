"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "not_configured" | "checking" | "connected" | "error";

export default function TodayPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!supabase) {
      Promise.resolve().then(() => {
        setStatus("not_configured");
        setMessage("Add keys to .env.local");
      });
      return;
    }

    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("connected");
        setMessage("Supabase connected");
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
            Status:{" "}
            <span className="font-medium">
              {status === "not_configured"
                ? "Not configured"
                : status === "checking"
                ? "Checking…"
                : status === "connected"
                ? "Connected"
                : "Error"}
            </span>
          </p>
          {message ? (
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
