"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Staff = { id: number; name: string; rota_start: string | null; rota_end: string | null };
type Shift = { id: number; staff_id: number; shift_date: string; start_time: string; end_time: string };
type Leave = { staff_id: number; start_date: string; end_date: string; leave_type: string };

function mondayOf(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}
function shiftWeek(iso: string, weeks: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
const hhmm = (t: string) => t.slice(0, 5);
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Rota is forward scheduling. Once a day is over, what actually happened
// lives in Attendance — the shift grid becomes read-only history instead.
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function RotaPage() {
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [days, setDays] = useState<string[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cell, setCell] = useState<{ staff: Staff; date: string; shift: Shift | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/rota?week_start=${weekStart}`, { cache: "no-store" });
    const d = await res.json();
    setDays(d.days ?? []);
    setStaff(d.staff ?? []);
    setShifts(d.shifts ?? []);
    setLeave(d.leave ?? []);
    setLoading(false);
  }, [weekStart]);
  useEffect(() => {
    load();
  }, [load]);

  const shiftAt = useMemo(() => {
    const m = new Map<string, Shift>();
    for (const s of shifts) m.set(`${s.staff_id}:${s.shift_date}`, s);
    return m;
  }, [shifts]);

  const onLeave = useCallback(
    (staffId: number, date: string) => leave.some((l) => l.staff_id === staffId && date >= l.start_date && date <= l.end_date),
    [leave],
  );

  const today = todayIso();
  // Read-only once the whole week is behind us; today stays editable.
  const weekIsPast = days.length > 0 && days[6] < today;

  async function generate(mode: "defaults" | "copy_previous") {
    if (weekIsPast) return;
    setBusy(true);
    const res = await fetch("/api/admin/rota/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart, mode }),
    });
    const d = await res.json();
    setBusy(false);
    load();
    if (typeof d.added === "number") alert(`${d.added} shift${d.added === 1 ? "" : "s"} added.`);
  }

  const weekTotal = (staffId: number) =>
    shifts
      .filter((s) => s.staff_id === staffId)
      .reduce((sum, s) => {
        const [sh, sm] = hhmm(s.start_time).split(":").map(Number);
        const [eh, em] = hhmm(s.end_time).split(":").map(Number);
        let mins = eh * 60 + em - (sh * 60 + sm);
        if (mins <= 0) mins += 1440;
        return sum + mins;
      }, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-lg font-semibold">Rota</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setWeekStart(shiftWeek(weekStart, -1))} className="rounded-lg border border-neutral-300 px-2 py-1.5">←</button>
        <span className="font-medium">
          {new Date(weekStart + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
          {new Date(days[6] + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
        <button onClick={() => setWeekStart(shiftWeek(weekStart, 1))} className="rounded-lg border border-neutral-300 px-2 py-1.5">→</button>
        <button onClick={() => setWeekStart(mondayOf())} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs">This week</button>
        {!weekIsPast && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => generate("copy_previous")} disabled={busy} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs disabled:opacity-50">Copy last week</button>
            <button onClick={() => generate("defaults")} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50">Fill from defaults</button>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        {weekIsPast
          ? "This week is in the past — read-only history. Fix what actually happened in Attendance instead."
          : "Click a cell to set or clear a shift. Neither button overwrites shifts you've already set."}
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Staff</th>
                {days.map((d, i) => (
                  <th key={d} className="px-2 py-2 text-center">
                    {DOW[i]}<br />
                    <span className="font-normal">{new Date(d + "T12:00:00Z").getUTCDate()}</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  {days.map((date) => {
                    const sh = shiftAt.get(`${s.id}:${date}`) ?? null;
                    const lv = onLeave(s.id, date);
                    const isPast = date < today;
                    const label = lv ? "Leave" : sh ? `${hhmm(sh.start_time)}–${hhmm(sh.end_time)}` : "off";
                    const tone = lv ? "bg-purple-100 text-purple-700" : sh ? "bg-emerald-100 text-emerald-800" : "text-neutral-300";
                    return (
                      <td key={date} className="p-1 text-center">
                        {isPast ? (
                          <div className={`w-full cursor-default rounded-md px-1 py-2 text-xs opacity-60 ${tone}`}>{label}</div>
                        ) : (
                          <button
                            onClick={() => setCell({ staff: s, date, shift: sh })}
                            className={`w-full rounded-md px-1 py-2 text-xs transition ${tone} ${sh ? "hover:bg-emerald-200" : lv ? "" : "hover:bg-neutral-100"}`}
                          >
                            {label}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-neutral-500">
                    {Math.floor(weekTotal(s.id) / 60)}h{weekTotal(s.id) % 60 ? ` ${weekTotal(s.id) % 60}m` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cell && (
        <ShiftModal
          staffName={cell.staff.name}
          date={cell.date}
          shift={cell.shift}
          defaults={{ start: cell.staff.rota_start, end: cell.staff.rota_end }}
          onClose={() => setCell(null)}
          onDone={() => {
            setCell(null);
            load();
          }}
          onSave={async (start, end) => {
            await fetch("/api/admin/rota", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ staff_id: cell.staff.id, shift_date: cell.date, start_time: start, end_time: end }),
            });
          }}
          onClear={async () => {
            if (cell.shift) await fetch(`/api/admin/rota/${cell.shift.id}`, { method: "DELETE" });
          }}
        />
      )}
    </div>
  );
}

function ShiftModal({
  staffName,
  date,
  shift,
  defaults,
  onClose,
  onDone,
  onSave,
  onClear,
}: {
  staffName: string;
  date: string;
  shift: Shift | null;
  defaults: { start: string | null; end: string | null };
  onClose: () => void;
  onDone: () => void;
  onSave: (start: string, end: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [start, setStart] = useState(shift ? shift.start_time.slice(0, 5) : defaults.start?.slice(0, 5) ?? "09:00");
  const [end, setEnd] = useState(shift ? shift.end_time.slice(0, 5) : defaults.end?.slice(0, 5) ?? "17:00");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5">
        <h2 className="font-semibold">{staffName}</h2>
        <p className="text-xs text-neutral-500">{new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">Start<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" /></label>
          <label className="text-xs text-neutral-500">End<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" /></label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-semibold hover:bg-neutral-200">Cancel</button>
          {shift && (
            <button
              onClick={async () => { setBusy(true); await onClear(); onDone(); }}
              disabled={busy}
              className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-red-600"
            >
              Clear
            </button>
          )}
          <button
            onClick={async () => { setBusy(true); await onSave(start, end); onDone(); }}
            disabled={busy}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
