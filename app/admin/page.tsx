"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clockTime, hm, runningMinutes } from "@/lib/format";

type Row = {
  id: number;
  staff_name: string;
  clock_in: string | null;
  clock_out: string | null;
  net_work_seconds: number;
  late_seconds: number;
  work_date: string;
};

type Dash = {
  today: string;
  timezone: string;
  counts: { onShift: number; clockedOutToday: number; lateToday: number; stuck: number; pendingCorrections: number };
  onShift: Row[];
  stuck: Row[];
  lateToday: Row[];
};

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const load = () => fetch("/api/admin/dashboard", { cache: "no-store" }).then((r) => r.json()).then(setD).catch(() => {});
    load();
    const a = setInterval(load, 30_000);
    const b = setInterval(() => setTick((n) => n + 1), 60_000); // refresh running timers
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  if (!d) return <p className="text-sm text-neutral-400">Loading…</p>;

  const cards = [
    { label: "On shift now", value: d.counts.onShift },
    { label: "Clocked out today", value: d.counts.clockedOutToday },
    { label: "Late today", value: d.counts.lateToday, warn: d.counts.lateToday > 0 },
    { label: "Missing clock-out", value: d.counts.stuck, warn: d.counts.stuck > 0 },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Today</h1>
        <span className="text-xs text-neutral-400">{new Date(d.today + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border bg-white p-3 ${c.warn ? "border-amber-300" : "border-neutral-200"}`}>
            <div className={`text-2xl font-bold ${c.warn ? "text-amber-600" : ""}`}>{c.value}</div>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">{c.label}</div>
          </div>
        ))}
      </div>

      {d.counts.pendingCorrections > 0 && (
        <Link href="/admin/corrections" className="mt-3 block rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100">
          {d.counts.pendingCorrections} correction request{d.counts.pendingCorrections === 1 ? "" : "s"} waiting →
        </Link>
      )}

      {d.stuck.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-600">Still clocked in — check these</h2>
          <div className="mt-2 space-y-1">
            {d.stuck.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <span>{r.staff_name}</span>
                <span className="text-amber-700">
                  in {clockTime(r.clock_in, d.timezone)} · {hm(runningMinutes(r.clock_in!) * 60)} ago
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">On shift now ({d.onShift.length})</h2>
        <div className="mt-2 space-y-1">
          {d.onShift.length === 0 && <p className="text-sm text-neutral-400">Nobody clocked in.</p>}
          {d.onShift.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {r.staff_name}
                {r.late_seconds > 0 && <span className="text-xs text-amber-600">late {hm(r.late_seconds)}</span>}
              </span>
              <span className="text-neutral-500">
                in {clockTime(r.clock_in, d.timezone)} · {hm(runningMinutes(r.clock_in!) * 60)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
