"use client";

import { useCallback, useEffect, useState } from "react";
import { clockTime, hm } from "@/lib/format";
import { SHIFT_STATUS_BADGE, type ShiftStatus } from "@/lib/shift-status";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
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

type AttRow = {
  staff_id: number; staff_name: string; work_date: string;
  clock_in: string | null; clock_out: string | null; net_work_seconds: number;
};
type PendingRow = { staff_id: number; staff_name: string; status: ShiftStatus };
type TodayRow = { staff_id: number; staff_name: string; clockIn: string; clockOut: string; net: string; status: ShiftStatus };

type HoursData = { columns: { key: string; header: string }[]; data: Record<string, string | number>[] };
type RangeRow = { staff_id: string; name: string; netHours: number };

export default function ReportsPage() {
  const [tab, setTab] = useState<"today" | "range">("today");
  const [from, setFrom] = useState(isoWeekStart());
  const [to, setTo] = useState(addDays(isoWeekStart(), 6));
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  const [staffId, setStaffId] = useState("");

  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);
  const [rangeRows, setRangeRows] = useState<RangeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/staff", { cache: "no-store" }).then((r) => r.json()).then((d) => setStaff(d.staff ?? [])).catch(() => {});
  }, []);

  const isToday = from === todayISO() && to === todayISO();

  const loadToday = useCallback(async () => {
    setLoading(true);
    const today = todayISO();
    const p = new URLSearchParams({ from: today, to: today });
    if (staffId) p.set("staff_id", staffId);
    const res = await fetch(`/api/admin/attendance?${p}`, { cache: "no-store" });
    const d = await res.json();
    const real: TodayRow[] = (d.rows ?? []).map((r: AttRow) => ({
      staff_id: r.staff_id, staff_name: r.staff_name,
      clockIn: clockTime(r.clock_in), clockOut: r.clock_out ? clockTime(r.clock_out) : "—",
      net: r.clock_out ? hm(r.net_work_seconds) : "—",
      status: (r.clock_out ? "Done" : "On Shift") as ShiftStatus,
    }));
    const pending: TodayRow[] = (d.pending ?? []).map((p: PendingRow) => ({
      staff_id: p.staff_id, staff_name: p.staff_name, clockIn: "—", clockOut: "—", net: "—", status: p.status,
    }));
    setTodayRows([...real, ...pending].sort((a, b) => a.staff_name.localeCompare(b.staff_name)));
    setLoading(false);
  }, [staffId]);

  const loadRange = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ type: "hours", from, to });
    if (staffId) p.set("staff_id", staffId);
    const res = await fetch(`/api/admin/reports?${p}`, { cache: "no-store" });
    const d: HoursData = await res.json();
    const byStaff = new Map<string, RangeRow>();
    for (const row of d.data ?? []) {
      const name = String(row.employee);
      const cur = byStaff.get(name) ?? { staff_id: name, name, netHours: 0 };
      cur.netHours += Number(row.net) || 0;
      byStaff.set(name, cur);
    }
    setRangeRows([...byStaff.values()].sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }, [from, to, staffId]);

  useEffect(() => {
    if (tab === "today") loadToday();
    else loadRange();
  }, [tab, loadToday, loadRange]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold">Reports</h1>

      <div className="mt-4 flex gap-1 rounded-lg border border-neutral-300 bg-white p-0.5 text-sm w-fit">
        <button onClick={() => setTab("today")} className={`rounded-md px-3 py-1.5 font-medium ${tab === "today" ? "bg-brand text-white" : "text-neutral-600"}`}>Today</button>
        <button onClick={() => setTab("range")} className={`rounded-md px-3 py-1.5 font-medium ${tab === "range" ? "bg-brand text-white" : "text-neutral-600"}`}>Date Range</button>
      </div>

      {tab === "range" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1"><span className="text-xs text-neutral-500">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-neutral-500">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5" /></label>
          <button onClick={() => { setFrom(todayISO()); setTo(todayISO()); }} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${isToday ? "border-brand bg-brand text-white" : "border-neutral-300 bg-white"}`}>Today</button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Staff</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5">
            <option value="">Everyone</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {tab === "today" ? (
          <a href={`/api/admin/reports?type=attendance&from=${todayISO()}&to=${todayISO()}${staffId ? `&staff_id=${staffId}` : ""}&format=csv`} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark">Download CSV</a>
        ) : (
          <a href={`/api/admin/reports?type=hours&from=${from}&to=${to}${staffId ? `&staff_id=${staffId}` : ""}&format=csv`} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark">Download CSV</a>
        )}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : tab === "today" ? (
        todayRows.length === 0 ? (
          <p className="mt-8 text-sm text-neutral-400">No one's rota'd today.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Clock in</th>
                  <th className="px-3 py-2">Clock out</th>
                  <th className="px-3 py-2">Net hours</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((r) => (
                  <tr key={r.staff_id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-medium">{r.staff_name}</td>
                    <td className="px-3 py-2">{r.clockIn}</td>
                    <td className="px-3 py-2">{r.clockOut}</td>
                    <td className="px-3 py-2">{r.net}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SHIFT_STATUS_BADGE[r.status]}`}>{r.status === "Not in" ? "Pending clock-in" : r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : rangeRows.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No data for this range.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Date range</th>
                <th className="px-3 py-2">Net hours</th>
              </tr>
            </thead>
            <tbody>
              {rangeRows.map((r) => (
                <tr key={r.staff_id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-neutral-500">{from} → {to}</td>
                  <td className="px-3 py-2">{r.netHours.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
