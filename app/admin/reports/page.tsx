"use client";

import { useCallback, useEffect, useState } from "react";

type Col = { key: string; header: string };

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

export default function ReportsPage() {
  const [type, setType] = useState("hours");
  const [from, setFrom] = useState(isoWeekStart());
  const [to, setTo] = useState(addDays(isoWeekStart(), 6));
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  const [staffId, setStaffId] = useState("");
  const [cols, setCols] = useState<Col[]>([]);
  const [data, setData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/staff", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setStaff(d.staff ?? []))
      .catch(() => {});
  }, []);

  const params = useCallback(() => {
    const p = new URLSearchParams({ type, from, to });
    if (staffId) p.set("staff_id", staffId);
    return p;
  }, [type, from, to, staffId]);

  const run = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/reports?${params()}`, { cache: "no-store" });
    const d = await res.json();
    setCols(d.columns ?? []);
    setData(d.data ?? []);
    setLoading(false);
  }, [params]);
  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold">Reports</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Report</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5">
            <option value="hours">Hours</option>
            <option value="attendance">Attendance</option>
            <option value="late">Late arrivals</option>
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-xs text-neutral-500">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5" /></label>
        <label className="flex flex-col gap-1"><span className="text-xs text-neutral-500">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5" /></label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Staff</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5">
            <option value="">Everyone</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <a href={`/api/admin/reports?${params()}&format=csv`} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark">Download CSV</a>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : data.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No data for this range.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>{cols.map((c) => <th key={c.key} className="px-3 py-2">{c.header}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  {cols.map((c) => <td key={c.key} className="px-3 py-2">{row[c.key] ?? ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
