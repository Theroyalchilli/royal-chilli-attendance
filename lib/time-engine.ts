/**
 * time-engine.ts — attendance time calculation.
 *
 * Ported from the standalone attendance-system's `backend/time_engine.py`.
 * Pure functions: no database, no I/O. Every path that writes attendance
 * figures (live clock-out, manual entry, approved correction, timesheet
 * rollup) goes through `computeShift`, so the numbers are computed one way.
 *
 * Core rules
 * ----------
 * - Instants are absolute (JS `Date` / ISO strings with an offset). Elapsed
 *   time is real elapsed time, so overnight shifts and DST transitions come
 *   out right for free — a shift crossing "spring forward" is genuinely one
 *   hour shorter in real seconds.
 * - Durations are whole seconds (integers). No floats — no payroll drift.
 * - Paid breaks count as worked time; unpaid breaks are subtracted.
 * - Derived numbers are never trusted from a client; callers recompute here
 *   and persist the result.
 */

export type Instant = Date | string;

export type BreakInput = {
  start: Instant;
  end: Instant | null;
  isPaid?: boolean;
};

export type ShiftInput = {
  clockIn: Instant | null;
  clockOut: Instant | null;
  breaks?: BreakInput[];
  scheduledStart?: Instant | null;
  scheduledEnd?: Instant | null;
  graceSeconds?: number;
  /** Worked seconds beyond this are overtime. Undefined/null disables daily OT. */
  dailyOvertimeThresholdSeconds?: number | null;
  /** Fixed unpaid break for the shift (rota break or per-day override). With no
   *  punched breaks in the current model, this is THE break. */
  autoDeductBreakSeconds?: number;
  /** Manager +/- adjustment in seconds (may be negative). Applied last. */
  adjustmentSeconds?: number;
  /** "now" for an in-progress shift's running total. Defaults to clockOut. */
  now?: Instant | null;
};

export type ShiftResult = {
  netWorkSeconds: number;
  regularSeconds: number;
  overtimeSeconds: number;
  totalBreakSeconds: number;
  paidBreakSeconds: number;
  unpaidBreakSeconds: number;
  autoBreakSeconds: number;
  adjustmentSeconds: number;
  lateSeconds: number;
  isLate: boolean;
  earlyDepartureSeconds: number;
  isOvernight: boolean;
  openShift: boolean;
  flaggedOpenBreak: boolean;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// An ISO string without a timezone designator (Z or ±hh:mm) is ambiguous —
// reject it, same as the Python engine rejects naive datetimes.
const TZ_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/;

function toDate(v: Instant, label: string): Date {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) throw new Error(`${label} is an invalid Date`);
    return v;
  }
  if (typeof v === "string") {
    if (!TZ_SUFFIX.test(v.trim())) {
      throw new Error(`${label} must carry a timezone offset (got "${v}")`);
    }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new Error(`${label} is unparseable ("${v}")`);
    return d;
  }
  throw new Error(`${label} must be a Date or ISO string`);
}

/** Real elapsed whole seconds from a to b (b must be >= a). */
function elapsed(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 1000);
}

function spansMidnightUtc(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() !== b.getUTCFullYear() ||
    a.getUTCMonth() !== b.getUTCMonth() ||
    a.getUTCDate() !== b.getUTCDate()
  );
}

function splitOvertime(worked: number, threshold: number | null | undefined): [number, number] {
  if (threshold == null || worked <= threshold) return [worked, 0];
  return [threshold, worked - threshold];
}

// ---------------------------------------------------------------------------
// Timezone: wall-clock time in an IANA zone -> absolute UTC instant
// ---------------------------------------------------------------------------

/** Milliseconds that `tz`'s wall clock is ahead of UTC at the given instant. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const hour = m.hour === 24 ? 0 : m.hour;
  const asUtc = Date.UTC(m.year, m.month - 1, m.day, hour, m.minute, m.second);
  return asUtc - instant.getTime();
}

/**
 * Turn a wall-clock date+time in `tz` into an absolute UTC Date. DST gap/fold
 * resolve deterministically (offset before the transition wins).
 */
export function wallTimeToUtc(
  year: number,
  month1to12: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  let ms = Date.UTC(year, month1to12 - 1, day, hour, minute);
  const off1 = tzOffsetMs(new Date(ms), tz);
  ms -= off1;
  const off2 = tzOffsetMs(new Date(ms), tz);
  if (off2 !== off1) ms += off1 - off2;
  return new Date(ms);
}

/**
 * Resolve a rota's wall-clock start/end for a work date into UTC instants.
 * If end <= start the shift is overnight and the end rolls to the next day.
 * `time` args are "HH:MM" (24h).
 */
export function resolveScheduled(
  workDate: string, // "YYYY-MM-DD"
  startTime: string, // "HH:MM"
  endTime: string,
  tz: string,
): { start: Date; end: Date; isOvernight: boolean } {
  const [y, mo, d] = workDate.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const isOvernight = eh * 60 + em <= sh * 60 + sm;
  const start = wallTimeToUtc(y, mo, d, sh, sm, tz);
  const endDay = new Date(Date.UTC(y, mo - 1, d + (isOvernight ? 1 : 0)));
  const end = wallTimeToUtc(
    endDay.getUTCFullYear(),
    endDay.getUTCMonth() + 1,
    endDay.getUTCDate(),
    eh,
    em,
    tz,
  );
  return { start, end, isOvernight };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeShift(s: ShiftInput): ShiftResult {
  const warnings: string[] = [];
  const zero: ShiftResult = {
    netWorkSeconds: 0,
    regularSeconds: 0,
    overtimeSeconds: 0,
    totalBreakSeconds: 0,
    paidBreakSeconds: 0,
    unpaidBreakSeconds: 0,
    autoBreakSeconds: 0,
    adjustmentSeconds: 0,
    lateSeconds: 0,
    isLate: false,
    earlyDepartureSeconds: 0,
    isOvernight: false,
    openShift: false,
    flaggedOpenBreak: false,
    warnings: [],
  };

  if (s.clockIn == null) return zero;

  const clockIn = toDate(s.clockIn, "clockIn");
  const openShift = s.clockOut == null;

  let end: Date;
  if (openShift) {
    if (s.now == null) throw new Error("open shift requires `now` to compute running time");
    end = toDate(s.now, "now");
  } else {
    end = toDate(s.clockOut!, "clockOut");
  }
  if (end.getTime() < clockIn.getTime()) throw new Error("clockOut / now precedes clockIn");

  const gross = elapsed(clockIn, end);
  const isOvernight = spansMidnightUtc(clockIn, end);

  // ---- breaks ----
  let totalBreak = 0;
  let paidBreak = 0;
  let unpaidBreak = 0;
  let flaggedOpenBreak = false;
  for (const b of s.breaks ?? []) {
    const bStart = toDate(b.start, "break.start");
    if (bStart.getTime() < clockIn.getTime()) warnings.push("break starts before clock-in");
    let bEnd: Date;
    if (b.end == null) {
      flaggedOpenBreak = true;
      bEnd = end; // cap a forgotten break at shift end
      warnings.push("break never ended; flagged for review");
    } else {
      bEnd = toDate(b.end, "break.end");
    }
    if (bEnd.getTime() < bStart.getTime()) throw new Error("break end precedes break start");
    const dur = elapsed(bStart, bEnd);
    totalBreak += dur;
    if (b.isPaid) paidBreak += dur;
    else unpaidBreak += dur;
  }

  // ---- net work ----
  const autoBreak = Math.max(0, s.autoDeductBreakSeconds ?? 0);
  if (autoBreak) {
    unpaidBreak += autoBreak;
    totalBreak += autoBreak;
  }
  const adjustment = s.adjustmentSeconds ?? 0;
  const netWork = Math.max(0, gross - unpaidBreak + adjustment);

  const [regular, overtime] = splitOvertime(netWork, s.dailyOvertimeThresholdSeconds);

  // ---- late ----
  let lateSeconds = 0;
  let isLate = false;
  if (s.scheduledStart != null) {
    const sched = toDate(s.scheduledStart, "scheduledStart");
    const lateness = clockIn.getTime() > sched.getTime() ? elapsed(sched, clockIn) : 0;
    if (lateness > (s.graceSeconds ?? 0)) {
      lateSeconds = lateness;
      isLate = true;
    }
  }

  // ---- early departure ----
  let early = 0;
  if (s.scheduledEnd != null && !openShift) {
    const schedEnd = toDate(s.scheduledEnd, "scheduledEnd");
    if (end.getTime() < schedEnd.getTime()) early = elapsed(end, schedEnd);
  }

  return {
    netWorkSeconds: netWork,
    regularSeconds: regular,
    overtimeSeconds: overtime,
    totalBreakSeconds: totalBreak,
    paidBreakSeconds: paidBreak,
    unpaidBreakSeconds: unpaidBreak,
    autoBreakSeconds: autoBreak,
    adjustmentSeconds: adjustment,
    lateSeconds,
    isLate,
    earlyDepartureSeconds: early,
    isOvernight,
    openShift,
    flaggedOpenBreak,
    warnings,
  };
}

/**
 * Additional overtime for a week, given each day's *regular* seconds (daily OT
 * already stripped so it isn't double-counted): seconds beyond the threshold.
 */
export function weeklyOvertime(dailyRegularSeconds: number[], weeklyThresholdSeconds: number): number {
  const totalRegular = dailyRegularSeconds.reduce((a, b) => a + b, 0);
  return Math.max(0, totalRegular - weeklyThresholdSeconds);
}
