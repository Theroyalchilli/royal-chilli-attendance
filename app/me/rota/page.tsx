"use client";

import { useCallback, useEffect, useState } from "react";

type Shift = { shift_date: string; start_time: string; end_time: string };
type Rota = {
  rota_start: string | null;
  rota_end: string | null;
  rota_start_2?: string | null;
  rota_end_2?: string | null;
  rota_working_days: number[] | null;
} | null;
type Leave = { start_date: string; end_date: string; leave_type: string };

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hm = (t: string) => t.slice(0, 5);
/** "HH:MM" pair → minutes, rolling past midnight when end <= start */
function mins(start: string, end: string) {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let d = m(end) - m(start);
  if (d <= 0) d += 1440;
  return d;
}
const dur = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;

function mondayOf(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}
function shiftWeek(iso: string, w: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + w * 7);
  return d.toISOString().slice(0, 10);
}

export default function MyRota() {
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [days, setDays] = useState<string[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rota, setRota] = useState<Rota>(null);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/me/rota?week_start=${weekStart}`, { cache: "no-store" });
    const d = await res.json();
    setDays(d.days ?? []);
    setShifts(d.shifts ?? []);
    setRota(d.rota ?? null);
    setLeave(d.leave ?? []);
    setLoading(false);
  }, [weekStart]);
  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const shiftsFor = (date: string) => shifts.filter((s) => s.shift_date === date);
  const onLeave = (date: string) => leave.some((l) => date >= l.start_date && date <= l.end_date);
  const rotaFor = (i: number) => {
    if (!rota?.rota_start || !rota.rota_end || !(rota.rota_working_days ?? [1, 2, 3, 4, 5]).includes(i + 1)) return null;
    const slots = [`${hm(rota.rota_start)}–${hm(rota.rota_end)}`];
    if (rota.rota_start_2 && rota.rota_end_2) slots.push(`${hm(rota.rota_start_2)}–${hm(rota.rota_end_2)}`);
    return slots.join(" & ");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">My Rota</h1>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <button onClick={() => setWeekStart(shiftWeek(weekStart, -1))} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5">←</button>
        <span className="font-medium">
          {days[0] && new Date(days[0] + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
          {days[6] && new Date(days[6] + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
        <button onClick={() => setWeekStart(shiftWeek(weekStart, 1))} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5">→</button>
        <button onClick={() => setWeekStart(mondayOf())} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs">This week</button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {days.map((date, i) => {
            const day = shiftsFor(date);
            const total = day.reduce((sum, s) => sum + mins(s.start_time, s.end_time), 0);
            const lv = onLeave(date);
            const fallback = rotaFor(i);
            return (
              <div key={date} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">
                  <span className="font-semibold">{DOW[i]}</span>{" "}
                  <span className="text-neutral-400">{new Date(date + "T12:00:00Z").getUTCDate()}</span>
                </span>
                {lv ? (
                  <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">On leave</span>
                ) : day.length > 0 ? (
                  <span className="flex flex-col items-end gap-1">
                    {day.map((s) => (
                      <span key={s.start_time} className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                        {hm(s.start_time)}–{hm(s.end_time)}
                      </span>
                    ))}
                    {day.length > 1 && <span className="text-[11px] text-neutral-400">Total {dur(total)}</span>}
                  </span>
                ) : fallback ? (
                  <span className="text-xs text-neutral-400">{fallback} (usual)</span>
                ) : (
                  <span className="text-xs text-neutral-300">off</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        &ldquo;Usual&rdquo; means your default pattern — a manager hasn&apos;t set a specific shift for that day yet.
      </p>
    </div>
  );
}
