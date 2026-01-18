"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CheckInModal from "@/components/CheckInModal";
import CreateChildModal from "@/components/CreateChildModal";

export default function TodayPage() {
  const router = useRouter();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
  }, [router]);

  return (
    <main className="min-h-dvh bg-white">
      <header className="w-full bg-teal-950 text-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-xl font-semibold">Kids Church Check-In</h1>
          <p className="text-sm opacity-90">Today</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6 space-y-4">
        {/* Empty state */}
        <div className="rounded-2xl border border-dashed bg-white p-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            No children checked in yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Use the button below to check a child in.
          </p>
        </div>

        {/* Primary action */}
        <button
          type="button"
          onClick={() => setCheckInOpen(true)}
          className="w-full rounded-xl bg-teal-950 px-4 py-3 text-sm font-medium text-white"
        >
          Check In Child
        </button>
      </div>

      {/* Check-in modal */}
      <CheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onNewChild={() => setCreateChildOpen(true)}
      >
        <div className="rounded-xl border bg-slate-50 p-3">
          <p className="text-sm text-slate-700">
            Placeholder: child search UI goes here.
          </p>
        </div>
      </CheckInModal>

      {/* Create child modal */}
      <CreateChildModal
        open={createChildOpen}
        onClose={() => setCreateChildOpen(false)}
        onCreated={() => {
          // In later steps we’ll refresh search results / allow immediate check-in.
        }}
      />
    </main>
  );
}
