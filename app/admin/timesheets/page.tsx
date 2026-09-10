"use client";

import { useCallback, useEffect, useState } from "react";
import { hm, decimalHours } from "@/lib/format";

type Totals = { net_seconds: number; regular_seconds: number; overtime_seconds: number; break_seconds: number; late_seconds: number; days_worked: number };
type Sheet = { id: number; status: string; locked: boolean; totals: Totals | null };
type Item = {
  staff_id: number;
  staff_name: string;
  pay_rate: number | null;
  live_totals: Totals;
  sheet: Sheet | null;
};

function isoWeekStart(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = { draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected", locked: "Locked 🔒" };

export default function TimesheetsPage() {
  const [weekStart, setWeekStart] = useState(isoWeekStart(new Date(Date.now() - 7 * 864e5)));
  const weekEnd = addDays(weekStart, 6);
  const [list, setList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/timesheets?period_start=${weekStart}&period_end=${weekEnd}`, { cache: "no-store" });
    setList((await res.json()).list ?? []);
    setLoading(false);
  }, [weekStart, weekEnd]);
  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    await fetch("/api/admin/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_start: weekStart, period_end: weekEnd }),
    });
    setBusy(false);
    load();
  }

  async function move(id: number, status: string) {
    setBusy(true);
    await fetch(`/api/admin/timesheets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold">Timesheets</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-lg border border-neutral-300 px-2 py-1.5">←</button>
        <span className="font-medium">Week of {new Date(weekStart + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-lg border border-neutral-300 px-2 py-1.5">→</button>
        <button onClick={generate} disabled={busy} className="ml-auto rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          {busy ? "…" : "Generate / refresh"}
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        Generate builds a timesheet per person from this week&apos;s closed shifts. Locked ones are left alone and are what Payroll reads.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Days</th>
                <th className="px-3 py-2">Regular</th>
                <th className="px-3 py-2">OT</th>
                <th className="px-3 py-2">Net</th>
                <th className="px-3 py-2">Est. pay</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((it) => {
                const t = it.sheet?.totals ?? it.live_totals;
                const stale = it.sheet && it.sheet.totals && it.sheet.totals.net_seconds !== it.live_totals.net_seconds;
                const pay = it.pay_rate ? `£${(decimalHours(t.net_seconds) * it.pay_rate).toFixed(2)}` : "—";
                return (
                  <tr key={it.staff_id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-medium">{it.staff_name}</td>
                    <td className="px-3 py-2 text-neutral-500">{t.days_worked}</td>
                    <td className="px-3 py-2">{hm(t.regular_seconds)}</td>
                    <td className="px-3 py-2">{t.overtime_seconds ? hm(t.overtime_seconds) : "—"}</td>
                    <td className="px-3 py-2 font-medium">{hm(t.net_seconds)}</td>
                    <td className="px-3 py-2 text-neutral-500">{pay}</td>
                    <td className="px-3 py-2 text-xs">
                      {it.sheet ? STATUS_LABEL[it.sheet.status] : <span className="text-neutral-400">not generated</span>}
                      {stale && <span className="ml-1 text-amber-600" title="attendance changed since this was generated">•</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {it.sheet?.status === "draft" && <button onClick={() => move(it.sheet!.id, "submitted")} className="text-blue-600 hover:underline">submit</button>}
                      {it.sheet?.status === "submitted" && <button onClick={() => move(it.sheet!.id, "approved")} className="text-emerald-600 hover:underline">approve</button>}
                      {it.sheet?.status === "approved" && <button onClick={() => move(it.sheet!.id, "locked")} className="text-neutral-700 hover:underline">lock</button>}
                      {it.sheet?.status === "locked" && <button onClick={() => move(it.sheet!.id, "approved")} className="text-neutral-400 hover:underline">unlock</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
