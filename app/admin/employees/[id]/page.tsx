"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { hm, dayLabel, clockTime } from "@/lib/format";
import { POS_HR_URL } from "@/lib/pos";

type Staff = {
  id: number;
  name: string;
  role: string;
  employee_number: string | null;
  employment_type: string | null;
  pay_rate: number | null;
  rota_start: string | null;
  rota_end: string | null;
  rota_working_days: number[] | null;
  rota_break_minutes: number | null;
  rota_grace_minutes: number | null;
};
type Row = {
  id: number;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_seconds: number;
  break_override_minutes: number | null;
  adjustment_seconds: number;
  net_work_seconds: number;
  late_seconds: number;
  approval_status: string;
  photo_missing: boolean;
  notes: string | null;
};
type Corr = {
  id: number;
  attendance_id: number | null;
  original_snapshot: Record<string, unknown>;
  requested_change: Record<string, unknown>;
  reason: string;
  status: string;
  created_at: string;
  review_note: string | null;
};
type Totals = { net_seconds: number; regular_seconds: number; overtime_seconds: number; break_seconds: number; late_seconds: number; days_worked: number };
type Timesheet = { id: number; status: string; locked: boolean; totals: Totals | null };
type Payment = { amount: number; method: string | null; paid_at: string; notes: string | null };
type PayrollEntry = {
  id: number;
  period_start: string | null;
  period_end: string | null;
  hours_worked: number;
  gross_pay: number;
  paid_amount: number;
  outstanding: number;
  status: string;
  payments: Payment[];
};
type Profile = {
  staff: Staff;
  range: { range: string; from: string; to: string };
  summary: { hours_seconds: number; days_worked: number; scheduled_days: number; late_count: number; absences: number; gross_pay: number; outstanding_pay: number };
  attendance: Row[];
  corrections: Corr[];
  timesheet: Timesheet | null;
  week: { from: string; to: string };
  payroll: PayrollEntry[];
};

const ROLE_LABEL: Record<string, string> = { employee: "Employee", manager: "Manager", hr: "HR", admin: "Admin" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  partially_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
};
const gbp = (n: number) => `£${n.toFixed(2)}`;
const d = (iso: string | null) => (iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?");

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
function rangeLabel(range: string, from: string, to: string) {
  if (range === "day") return dayLabel(from);
  if (range === "month") return new Date(from + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${dayLabel(from)} – ${dayLabel(to)}`;
}

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const staffId = params.id;

  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(todayISO());
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingRota, setEditingRota] = useState(false);
  const [corrBusy, setCorrBusy] = useState<number | null>(null);
  const [tsBusy, setTsBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/employees/${staffId}?range=${range}&date=${anchor}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [staffId, range, anchor]);
  useEffect(() => {
    load();
  }, [load]);

  function step(n: number) {
    setAnchor((a) => (range === "day" ? addDays(a, n) : range === "week" ? addDays(a, n * 7) : addMonths(a, n)));
  }

  async function reviewCorrection(id: number, action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Reason for rejecting (optional):") ?? "" : "";
    setCorrBusy(id);
    await fetch(`/api/admin/corrections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, review_note: note }),
    });
    setCorrBusy(null);
    load();
  }

  async function moveTimesheet(status: string) {
    if (!data?.timesheet) return;
    setTsBusy(true);
    await fetch(`/api/admin/timesheets/${data.timesheet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTsBusy(false);
    load();
  }

  if (loading && !data) return <p className="mx-auto max-w-4xl text-sm text-neutral-400">Loading…</p>;
  if (!data) return <p className="mx-auto max-w-4xl text-sm text-neutral-400">Employee not found.</p>;

  const { staff, summary } = data;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{staff.name}</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {ROLE_LABEL[staff.role] ?? staff.role}
              {staff.employee_number && ` · ${staff.employee_number}`}
              {staff.pay_rate != null && ` · £${staff.pay_rate}/hr`}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {staff.rota_start && staff.rota_end
                ? `Rota: ${staff.rota_start.slice(0, 5)}–${staff.rota_end.slice(0, 5)} · ${(staff.rota_working_days ?? []).map((i) => DAYS[i - 1]).join(" ")}`
                : "No default rota set"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <a href={POS_HR_URL} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">
              Open full HR record →
            </a>
            <button onClick={() => setEditingRota(true)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">
              Edit rota
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-neutral-300 bg-white p-0.5 text-sm">
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
        <button onClick={() => step(-1)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5">←</button>
        <span className="min-w-[9rem] text-center text-sm font-medium">{rangeLabel(data.range.range, data.range.from, data.range.to)}</span>
        <button onClick={() => step(1)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5">→</button>
        <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm" />
        <button onClick={() => setAnchor(todayISO())} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs">Today</button>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { l: "Hours worked", v: hm(summary.hours_seconds) },
          { l: "Days worked", v: `${summary.days_worked} / ${summary.scheduled_days}` },
          { l: "Late", v: String(summary.late_count) },
          { l: "Absences", v: String(summary.absences) },
          { l: "Gross pay", v: gbp(summary.gross_pay) },
          { l: "Outstanding pay", v: gbp(summary.outstanding_pay) },
        ].map((c) => (
          <div key={c.l} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="text-xs text-neutral-400">{c.l}</div>
            <div className="mt-0.5 text-lg font-semibold">{c.v}</div>
          </div>
        ))}
      </div>

      {/* Attendance */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Attendance</h2>
          <button onClick={() => setAdding(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
            + Manual entry
          </button>
        </div>
        {data.attendance.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Nothing in this range.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">In</th>
                  <th className="px-3 py-2">Out</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.map((r) => (
                  <tr key={r.id} onClick={() => setEditingRow(r)} className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-medium">{dayLabel(r.work_date)}</td>
                    <td className="px-3 py-2">{clockTime(r.clock_in)}</td>
                    <td className="px-3 py-2">{r.clock_out ? clockTime(r.clock_out) : <span className="text-emerald-600">open</span>}</td>
                    <td className="px-3 py-2">{r.clock_out ? hm(r.net_work_seconds) : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.late_seconds > 0 && <span className="mr-1 text-amber-600">late {hm(r.late_seconds)}</span>}
                      {r.photo_missing && <span className="mr-1 text-neutral-400">no photo</span>}
                      {r.approval_status === "pending" && <span className="text-amber-600">needs review</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Corrections */}
      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Corrections</h2>
        {data.corrections.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">No correction requests.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {data.corrections.map((c) => (
              <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">{dayLabel(c.created_at.slice(0, 10))}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "pending" ? "bg-amber-100 text-amber-700" : c.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100"}`}>
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">“{c.reason}”</p>
                {c.review_note && <p className="mt-1 text-xs text-neutral-500">Note: {c.review_note}</p>}
                {c.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => reviewCorrection(c.id, "approve")} disabled={corrBusy === c.id} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
                    <button onClick={() => reviewCorrection(c.id, "reject")} disabled={corrBusy === c.id} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Timesheet (this week) */}
      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Timesheet — week of {dayLabel(data.week.from)}</h2>
        {!data.timesheet ? (
          <p className="mt-2 text-sm text-neutral-400">
            Not generated yet. Use <a href="/admin/timesheets" className="text-brand hover:underline">Timesheets</a> to build the week.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-sm">
              <span className="font-medium capitalize">{data.timesheet.status}</span>
              {data.timesheet.totals && <span className="ml-2 text-neutral-500">{hm(data.timesheet.totals.net_seconds)} net · {data.timesheet.totals.days_worked} days</span>}
            </div>
            <div className="flex gap-2 text-xs">
              {data.timesheet.status === "approved" && (
                <button onClick={() => moveTimesheet("locked")} disabled={tsBusy} className="rounded-lg bg-neutral-800 px-3 py-1.5 font-semibold text-white disabled:opacity-50">Lock</button>
              )}
              {data.timesheet.status === "locked" && (
                <button onClick={() => moveTimesheet("approved")} disabled={tsBusy} className="rounded-lg border border-neutral-300 px-3 py-1.5">Unlock</button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Payroll — read only */}
      <section className="mt-6 mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Payroll (view only)</h2>
        <p className="mt-1 text-xs text-neutral-400">All payroll edits and payments happen in the POS.</p>
        {data.payroll.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">No pay periods yet.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {data.payroll.map((p) => (
              <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{d(p.period_start)} – {d(p.period_end)}</p>
                    <p className="text-xs text-neutral-400">{p.hours_worked} h</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{gbp(p.gross_pay)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[p.status] ?? "bg-neutral-100"}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-center text-sm">
                  <div><div className="text-xs text-neutral-400">Gross</div><div className="font-medium">{gbp(p.gross_pay)}</div></div>
                  <div><div className="text-xs text-neutral-400">Paid</div><div className="font-medium text-emerald-600">{gbp(p.paid_amount)}</div></div>
                  <div><div className="text-xs text-neutral-400">Outstanding</div><div className="font-medium text-amber-600">{gbp(p.outstanding)}</div></div>
                </div>
                {p.payments.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold uppercase text-neutral-400">Payments</p>
                    {p.payments.map((pay, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span>{new Date(pay.paid_at).toLocaleDateString("en-GB")} {pay.method && `· ${pay.method.replace("_", " ")}`}</span>
                        <span className="font-medium">{gbp(pay.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {editingRow && <AttendanceEditModal row={editingRow} onClose={() => setEditingRow(null)} onSaved={() => { setEditingRow(null); load(); }} />}
      {adding && <ManualEntryModal staffId={Number(staffId)} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {editingRota && <RotaModal staff={staff} onClose={() => setEditingRota(false)} onSaved={() => { setEditingRota(false); load(); }} />}
    </div>
  );
}

// datetime-local wants "YYYY-MM-DDTHH:MM" in local time
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const x = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function AttendanceEditModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
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
    if (!confirm(`Delete the ${row.work_date} entry?`)) return;
    setBusy(true);
    await fetch(`/api/admin/attendance/${row.id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="font-semibold">{dayLabel(row.work_date)}</h2>

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
            <button onClick={() => setClockOut(toLocalInput(new Date().toISOString()))} className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm">Set out = now</button>
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

function ManualEntryModal({ staffId, onClose, onSaved }: { staffId: number; onClose: () => void; onSaved: () => void }) {
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!clockIn) return setErr("Pick a clock-in time");
    setBusy(true);
    setErr("");
    const inDate = new Date(clockIn);
    const res = await fetch("/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: staffId,
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
        <p className="mt-1 text-xs text-neutral-500">For a shift they forgot to clock. Auto-approved.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
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

function RotaModal({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const [start, setStart] = useState(staff.rota_start?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(staff.rota_end?.slice(0, 5) ?? "");
  const [days, setDays] = useState<number[]>(staff.rota_working_days ?? [1, 2, 3, 4, 5]);
  const [breakMin, setBreakMin] = useState(String(staff.rota_break_minutes ?? 0));
  const [graceMin, setGraceMin] = useState(staff.rota_grace_minutes == null ? "" : String(staff.rota_grace_minutes));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/admin/staff/${staff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rota_start: start || null,
        rota_end: end || null,
        rota_working_days: days,
        rota_break_minutes: Number(breakMin) || 0,
        rota_grace_minutes: graceMin === "" ? null : Number(graceMin),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json()).error || "Save failed");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="font-semibold">{staff.name} — rota</h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Rota start</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Rota end</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <label className="mt-4 block text-xs text-neutral-500">Working days</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DAYS.map((label, i) => {
            const iso = i + 1;
            const on = days.includes(iso);
            return (
              <button
                key={label}
                onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== iso) : [...cur, iso].sort()))}
                className={`rounded-lg border px-2.5 py-1 text-xs ${on ? "border-brand bg-brand/10 text-brand" : "border-neutral-300 text-neutral-500"}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Unpaid break (min)</label>
            <input type="number" min={0} value={breakMin} onChange={(e) => setBreakMin(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Grace (min, blank = default)</label>
            <input type="number" min={0} value={graceMin} onChange={(e) => setGraceMin(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-semibold hover:bg-neutral-200">Cancel</button>
          <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
