"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clockTime, dayLabel, hm } from "@/lib/format";
import { SHIFT_STATUS_BADGE, SHIFT_STATUS_LABEL, type ShiftStatus } from "@/lib/shift-status";

type Row = {
  id: number;
  staff_id: number;
  staff_name: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_method: string | null;
  clock_out_method: string | null;
  break_seconds: number;
  break_override_minutes: number | null;
  adjustment_seconds: number;
  net_work_seconds: number;
  late_seconds: number;
  status: string;
  approval_status: string;
  photo_missing: boolean;
  notes: string | null;
  is_stuck: boolean;
};
type Staff = { id: number; name: string };
type Pending = { staff_id: number; staff_name: string; work_date: string; shift_start: string; shift_end: string; status: ShiftStatus };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const x = new Date(iso + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number) {
  const [y, m, day] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, lastDay));
  return x.toISOString().slice(0, 10);
}
/** [from, to] (inclusive) for "day" | "week" (Mon–Sun) | "month" around `anchor`. */
function rangeFor(range: "day" | "week" | "month", anchor: string): { from: string; to: string } {
  if (range === "week") {
    const weekday = new Date(anchor + "T12:00:00Z").getUTCDay(); // 0=Sun..6=Sat
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const from = addDays(anchor, mondayOffset);
    return { from, to: addDays(from, 6) };
  }
  if (range === "month") {
    const [y, m] = anchor.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from, to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
  }
  return { from: anchor, to: anchor }; // day
}
function rangeLabel(range: string, from: string, to: string) {
  if (range === "day") return dayLabel(from);
  if (range === "month") return new Date(from + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${dayLabel(from)} – ${dayLabel(to)}`;
}

export default function AttendancePage() {
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const [anchor, setAnchor] = useState(todayISO());
  const [staffId, setStaffId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [quickClockIn, setQuickClockIn] = useState<Pending | null>(null);
  const [openTargetId, setOpenTargetId] = useState<number | null>(null);

  const { from, to } = rangeFor(range, anchor);

  // Arriving from a notification link (?staff_id=&date=&open=) — jump straight
  // to that person's day and queue their record to auto-open once it loads.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qsStaffId = params.get("staff_id");
    const qsDate = params.get("date");
    const qsOpen = params.get("open");
    if (qsStaffId) setStaffId(qsStaffId);
    if (qsDate) { setRange("day"); setAnchor(qsDate); }
    if (qsOpen) setOpenTargetId(Number(qsOpen));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ from, to });
    if (staffId) p.set("staff_id", staffId);
    const res = await fetch(`/api/admin/attendance?${p}`, { cache: "no-store" });
    const data = await res.json();
    setRows(data.rows ?? []);
    setStaff(data.staff ?? []);
    setPending(data.pending ?? []);
    setLoading(false);
  }, [from, to, staffId]);
  useEffect(() => {
    load();
  }, [load]);

  // Once the targeted row has actually loaded, open it — clearing the target
  // so navigating away and back (or a later manual load) doesn't reopen it.
  useEffect(() => {
    if (openTargetId == null) return;
    const match = rows.find((r) => r.id === openTargetId);
    if (match) {
      setEditing(match);
      setOpenTargetId(null);
    }
  }, [openTargetId, rows]);

  function step(n: number) {
    setAnchor((a) => (range === "day" ? addDays(a, n) : range === "week" ? addDays(a, n * 7) : addMonths(a, n)));
  }
  const rangeNoun = range === "day" ? "Day" : range === "week" ? "Week" : "Month";

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      if (!m.has(r.work_date)) m.set(r.work_date, []);
      m.get(r.work_date)!.push(r);
    }
    return [...m.entries()];
  }, [rows]);

  const pendingByDate = useMemo(() => {
    const m = new Map<string, Pending[]>();
    for (const p of pending) {
      if (!m.has(p.work_date)) m.set(p.work_date, []);
      m.get(p.work_date)!.push(p);
    }
    return m;
  }, [pending]);

  // Dates that have pending issues but zero real attendance rows still need
  // their own group — grouped-by-rows alone would skip them entirely.
  const allDates = useMemo(() => {
    const s = new Set([...grouped.map(([d]) => d), ...pendingByDate.keys()]);
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [grouped, pendingByDate]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-semibold">Attendance</h1>
        <button onClick={() => setAdding(true)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          + Manual entry
        </button>
      </div>

      {/* Row 1 — mode + what's currently shown */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        <div className="flex rounded-lg border border-neutral-300 bg-white p-0.5">
          {(["day", "week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1 capitalize ${range === r ? "bg-brand text-white" : "text-neutral-600"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="font-medium">{rangeLabel(range, from, to)}</span>
      </div>

      {/* Row 2 — previous/next (grouped, compact), staff filter opposite */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => step(-1)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-medium hover:bg-neutral-50">
            ← Previous {rangeNoun}
          </button>
          <button onClick={() => step(1)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-medium hover:bg-neutral-50">
            Next {rangeNoun} →
          </button>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Staff</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5">
            <option value="">Everyone</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 3 — jump to any date */}
      <div className="mt-2 flex items-center gap-2 text-sm">
        <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5" />
        <button onClick={() => setAnchor(todayISO())} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs">Today</button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : allDates.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No attendance in this range.</p>
      ) : (
        <div className="mt-5 space-y-5">
          {allDates.map((date) => {
            const dayRows = grouped.find(([d]) => d === date)?.[1] ?? [];
            const dayPending = pendingByDate.get(date) ?? [];
            return (
            <div key={date}>
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">{dayLabel(date)}</h2>
              <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Rota</th>
                      <th className="px-3 py-2">In</th>
                      <th className="px-3 py-2">Out</th>
                      <th className="px-3 py-2">Net</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayPending.map((p) => (
                      <tr key={`pending-${p.staff_id}`} className="border-t border-neutral-100 bg-amber-50/50">
                        <td className="px-3 py-2 font-medium">{p.staff_name}</td>
                        <td className="px-3 py-2 text-neutral-500">{p.shift_start} – {p.shift_end}</td>
                        <td className="px-3 py-2 text-neutral-400">—</td>
                        <td className="px-3 py-2 text-neutral-400">—</td>
                        <td className="px-3 py-2 text-neutral-400">—</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SHIFT_STATUS_BADGE[p.status]}`}>{SHIFT_STATUS_LABEL[p.status]}</span>
                            <button onClick={() => setQuickClockIn(p)} className="rounded-lg bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-dark">Clock in now</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {dayRows.map((r) => (
                      <tr key={r.id} onClick={() => setEditing(r)} className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50">
                        <td className="px-3 py-2 font-medium">{r.staff_name}</td>
                        <td className="px-3 py-2 text-neutral-400">—</td>
                        <td className="px-3 py-2">{clockTime(r.clock_in)}</td>
                        <td className="px-3 py-2">{r.clock_out ? clockTime(r.clock_out) : <span className={r.is_stuck ? "text-red-600" : "text-emerald-600"}>open</span>}</td>
                        <td className="px-3 py-2">{r.clock_out ? hm(r.net_work_seconds) : "—"}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.is_stuck && <span className="mr-1 rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">forgotten clock-out</span>}
                          {r.late_seconds > 0 && <span className="mr-1 text-amber-600">late {hm(r.late_seconds)}</span>}
                          {r.adjustment_seconds !== 0 && <span className="mr-1 text-blue-600">adj {r.adjustment_seconds > 0 ? "+" : ""}{Math.round(r.adjustment_seconds / 60)}m</span>}
                          {r.photo_missing && <span className="mr-1 text-neutral-400">no photo</span>}
                          {r.approval_status === "pending" && !r.is_stuck && <span className="text-amber-600">needs review</span>}
                          {!r.clock_out && !r.is_stuck && !r.late_seconds && r.adjustment_seconds === 0 && !r.photo_missing && r.approval_status !== "pending" && <span className="text-emerald-600">on shift</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {adding && <ManualEntryModal staff={staff} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {quickClockIn && (
        <ManualEntryModal
          staff={staff}
          prefill={{ staffId: String(quickClockIn.staff_id), clockIn: toLocalInput(new Date().toISOString()) }}
          onClose={() => setQuickClockIn(null)}
          onSaved={() => { setQuickClockIn(null); load(); }}
        />
      )}
    </div>
  );
}

// datetime-local wants "YYYY-MM-DDTHH:MM" in local time
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [clockIn, setClockIn] = useState(toLocalInput(row.clock_in));
  const [clockOut, setClockOut] = useState(toLocalInput(row.clock_out));
  const [breakOverride, setBreakOverride] = useState(row.break_override_minutes == null ? "" : String(row.break_override_minutes));
  const [adjustMin, setAdjustMin] = useState(String(Math.round(row.adjustment_seconds / 60)));
  const [notes, setNotes] = useState(row.notes ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ leg: "in" | "out"; url: string } | null>(null);

  async function showPhoto(leg: "in" | "out") {
    const res = await fetch(`/api/admin/attendance/${row.id}/photo?leg=${leg}`);
    if (res.ok) setPhoto({ leg, url: (await res.json()).url });
  }

  async function save(extra?: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/admin/attendance/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clock_in: clockIn ? new Date(clockIn).toISOString() : null,
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
        break_override_minutes: breakOverride === "" ? null : Number(breakOverride),
        adjustment_seconds: Math.round((Number(adjustMin) || 0) * 60),
        notes,
        ...extra,
      }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Save failed");
    onSaved();
  }

  async function del() {
    if (!confirm(`Delete ${row.staff_name}'s ${row.work_date} entry?`)) return;
    setBusy(true);
    await fetch(`/api/admin/attendance/${row.id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="font-semibold">{row.staff_name}<span className="ml-2 text-sm font-normal text-neutral-400">{dayLabel(row.work_date)}</span></h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">
            Clock in
            <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" />
          </label>
          <label className="text-xs text-neutral-500">
            Clock out
            <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">
            Break override (min)
            <input type="number" min={0} value={breakOverride} placeholder="rota default" onChange={(e) => setBreakOverride(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" />
          </label>
          <label className="text-xs text-neutral-500">
            Adjustment (± min)
            <input type="number" value={adjustMin} onChange={(e) => setAdjustMin(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" />
          </label>
        </div>

        <label className="mt-3 block text-xs text-neutral-500">
          Note
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" />
        </label>

        <div className="mt-3 flex gap-3 text-xs">
          {!row.photo_missing && row.clock_in && <button onClick={() => showPhoto("in")} className="text-blue-600 hover:underline">clock-in photo</button>}
          {!row.photo_missing && row.clock_out && <button onClick={() => showPhoto("out")} className="text-blue-600 hover:underline">clock-out photo</button>}
        </div>
        {photo && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={`clock ${photo.leg}`} className="max-h-48 rounded-lg border border-neutral-200" />
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-semibold hover:bg-neutral-200">Cancel</button>
          {row.clock_in && !row.clock_out && (
            <button onClick={() => { setClockOut(toLocalInput(new Date().toISOString())); }} className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm">Set out = now</button>
          )}
          {row.approval_status === "pending" && (
            <button onClick={() => save({ approval_status: "approved" })} disabled={busy} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white">Approve</button>
          )}
          <button onClick={() => save()} disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        <button onClick={del} disabled={busy} className="mt-2 w-full text-xs text-red-500 hover:underline">Delete this entry</button>
      </div>
    </div>
  );
}

function ManualEntryModal({ staff, prefill, onClose, onSaved }: { staff: Staff[]; prefill?: { staffId: string; clockIn: string }; onClose: () => void; onSaved: () => void }) {
  const [staffId, setStaffId] = useState(prefill?.staffId ?? "");
  const [clockIn, setClockIn] = useState(prefill?.clockIn ?? "");
  const [clockOut, setClockOut] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!staffId || !clockIn) return setErr("Pick a staff member and a clock-in time");
    setBusy(true);
    setErr("");
    const inDate = new Date(clockIn);
    const res = await fetch("/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: Number(staffId),
        work_date: `${inDate.getFullYear()}-${String(inDate.getMonth() + 1).padStart(2, "0")}-${String(inDate.getDate()).padStart(2, "0")}`,
        clock_in: inDate.toISOString(),
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
        notes,
      }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Failed");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="font-semibold">Manual entry</h2>
        <p className="mt-1 text-xs text-neutral-500">For a shift someone forgot to clock. Auto-approved.</p>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="">Staff member…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">Clock in<input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" /></label>
          <label className="text-xs text-neutral-500">Clock out<input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" /></label>
        </div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-semibold hover:bg-neutral-200">Cancel</button>
          <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "Saving…" : "Add"}</button>
        </div>
      </div>
    </div>
  );
}
