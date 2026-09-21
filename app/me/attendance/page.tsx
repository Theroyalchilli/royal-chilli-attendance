"use client";

import { useCallback, useEffect, useState } from "react";
import { clockTime, dayLabel, hm } from "@/lib/format";

type Row = {
  id: number;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_method: string | null;
  net_work_seconds: number;
  overtime_seconds: number;
  late_seconds: number;
  status: string;
};
type Totals = { net_seconds: number; overtime_seconds: number; break_seconds: number; days_worked: number; late_count: number };

function monthRange(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)] as const;
}
function weekRange(d = new Date()) {
  const mon = new Date(d);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)] as const;
}

export default function MyAttendance() {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const base = new Date();
  if (mode === "week") base.setDate(base.getDate() + offset * 7);
  else base.setMonth(base.getMonth() + offset);
  const [from, to] = mode === "week" ? weekRange(base) : monthRange(base);
  const label =
    mode === "week"
      ? `${new Date(from + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(to + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
      : new Date(from + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/me/attendance?from=${from}&to=${to}`, { cache: "no-store" });
    const d = await res.json();
    setRows(d.rows ?? []);
    setTotals(d.totals ?? null);
    setLoading(false);
  }, [from, to]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">My Hours</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <div className="flex rounded-lg border border-neutral-300 bg-white p-0.5">
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setOffset(0); }}
              className={`rounded-md px-3 py-1 capitalize ${mode === m ? "bg-brand text-white" : "text-neutral-500"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button onClick={() => setOffset((o) => o - 1)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5">←</button>
        <span className="font-medium">{label}</span>
        <button onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 disabled:opacity-40">→</button>
      </div>

      {totals && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Worked", v: hm(totals.net_seconds) },
            { l: "Overtime", v: totals.overtime_seconds ? hm(totals.overtime_seconds) : "—" },
            { l: "Days", v: String(totals.days_worked) },
            { l: "Late", v: String(totals.late_count) },
          ].map((c) => (
            <div key={c.l} className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="text-lg font-bold">{c.v}</div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">{c.l}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No clock-ins in this range.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">In</th>
                <th className="px-3 py-2">Out</th>
                <th className="px-3 py-2">Hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{dayLabel(r.work_date)}</td>
                  <td className="px-3 py-2">
                    {clockTime(r.clock_in)}
                    {r.late_seconds > 0 && <span className="ml-1 text-xs text-amber-600">+{hm(r.late_seconds)} late</span>}
                  </td>
                  <td className="px-3 py-2">{r.clock_out ? clockTime(r.clock_out) : <span className="text-emerald-600">open</span>}</td>
                  <td className="px-3 py-2 font-medium">{r.clock_out ? hm(r.net_work_seconds) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        These are your raw clock-in/out times. If something&apos;s wrong,{" "}
        <a href="/me/requests?tab=corrections" className="text-brand hover:underline">raise a correction</a>.
      </p>
    </div>
  );
}
