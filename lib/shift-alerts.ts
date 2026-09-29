import { resolveScheduled } from "./time-engine";

// Which shift alerts are due right now. Checked every 5 minutes (cron-job.org
// → /api/cron/shift-alerts). Each window is a few minutes wide so a check that
// runs a little late still catches it, but never so wide that a timer outage
// sends stale alerts hours later. Each alert goes once per shift
// (shift_alerts_sent).
//
//   before_start      15 min before start, not clocked in yet → staff
//   not_clocked_in    5 min after start, still not in         → staff + managers
//   forgot_clock_out  10 min after end, still clocked in      → staff

export const BEFORE_START_MIN = 15;
export const LATE_AFTER_MIN = 5;
export const CLOCK_OUT_AFTER_MIN = 10;

export type AlertKind = "before_start" | "not_clocked_in" | "forgot_clock_out";
export type ShiftRow = { id: number; staff_id: number; shift_date: string; start_time: string; end_time: string; business_id?: number };
export type AttRow = { staff_id: number; shift_id: number | null; clock_in: string | null; clock_out: string | null };
export type DueAlert = { shift: ShiftRow; kind: AlertKind; start: Date; end: Date };

const MIN = 60_000;

export function dueShiftAlerts(args: {
  now: Date;
  tz: string;
  shifts: ShiftRow[];
  attendance: AttRow[];
  alreadySent: Set<string>; // `${shift_id}:${kind}`
  onLeave: (staffId: number, date: string) => boolean;
}): DueAlert[] {
  const { now, tz, shifts, attendance, alreadySent, onLeave } = args;
  const t = now.getTime();
  const due: DueAlert[] = [];

  for (const shift of shifts) {
    if (onLeave(shift.staff_id, shift.shift_date)) continue;
    const { start, end } = resolveScheduled(shift.shift_date, shift.start_time.slice(0, 5), shift.end_time.slice(0, 5), tz);
    const s = start.getTime();
    const e = end.getTime();

    // their attendance for this shift: linked to it, or clocked in around it
    const mine = attendance.filter(
      (a) =>
        a.staff_id === shift.staff_id &&
        a.clock_in &&
        (a.shift_id === shift.id || (new Date(a.clock_in).getTime() >= s - 3 * 60 * MIN && new Date(a.clock_in).getTime() < e)),
    );
    const clockedIn = mine.length > 0;
    const stillIn = mine.some((a) => !a.clock_out);

    const add = (kind: AlertKind) => {
      if (!alreadySent.has(`${shift.id}:${kind}`)) due.push({ shift, kind, start, end });
    };
    if (!clockedIn && t >= s - BEFORE_START_MIN * MIN && t < s) add("before_start");
    if (!clockedIn && t >= s + LATE_AFTER_MIN * MIN && t < Math.min(s + 60 * MIN, e)) add("not_clocked_in");
    if (stillIn && t >= e + CLOCK_OUT_AFTER_MIN * MIN && t < e + 3 * 60 * MIN) add("forgot_clock_out");
  }
  return due;
}
