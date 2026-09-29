import supabase from "./supabase";
import { bizDb } from "./business-db";
import { resolveScheduled } from "./time-engine";
import { localIsoWeekday, type AttendanceSettings } from "./settings";

export type StaffRota = {
  rota_start: string | null; // "HH:MM:SS"
  rota_end: string | null;
  /** optional second slot of the usual pattern (split shift) — POS migration 066 */
  rota_start_2?: string | null;
  rota_end_2?: string | null;
  rota_working_days: number[] | null;
  rota_break_minutes: number | null;
  rota_grace_minutes: number | null;
};

export type ResolvedSchedule = {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  breakMinutes: number;
  graceMinutes: number;
  shiftId: number | null;
};

/** One scheduled block of work on a day. A split-shift day has two or more. */
export type Slot = { start: Date; end: Date; shiftId: number | null };

const hhmm = (t: string) => t.slice(0, 5); // "09:00:00" -> "09:00"

const ROTA_COLS = "rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes";
const EMPTY_ROTA: StaffRota = {
  rota_start: null,
  rota_end: null,
  rota_start_2: null,
  rota_end_2: null,
  rota_working_days: null,
  rota_break_minutes: null,
  rota_grace_minutes: null,
};

/**
 * A staff member's usual-rota columns (plus any `extra` columns). Falls back
 * to the single-slot columns if migration 066 (rota_start_2/rota_end_2)
 * hasn't been run yet, so clocking in never breaks on a missing column.
 */
export async function loadStaffRota<T extends object = object>(
  staffId: number,
  extra = "",
): Promise<StaffRota & Partial<T>> {
  const cols = `${ROTA_COLS}${extra ? `, ${extra}` : ""}`;
  const withSecond = await supabase
    .from("staff")
    .select(`${cols}, rota_start_2, rota_end_2`)
    .eq("id", staffId)
    .maybeSingle();
  if (!withSecond.error) return { ...EMPTY_ROTA, ...((withSecond.data ?? {}) as object) } as StaffRota & Partial<T>;
  const { data } = await supabase.from("staff").select(cols).eq("id", staffId).maybeSingle();
  return { ...EMPTY_ROTA, ...((data ?? {}) as object) } as StaffRota & Partial<T>;
}

/**
 * Every scheduled block for a staff member on `workDate` ("YYYY-MM-DD"),
 * earliest first: the explicit `shifts` rows for that date if there are any;
 * otherwise the usual pattern on `staff` (one or two slots) if it's a
 * working day; otherwise none.
 */
export async function scheduleSlotsFor(
  businessId: number,
  staffId: number,
  workDate: string,
  rota: StaffRota,
  settings: AttendanceSettings,
): Promise<Slot[]> {
  // Shifts at this business only — someone may also work at another.
  const { data: shifts } = await bizDb(businessId)
    .from("shifts")
    .select("id, start_time, end_time")
    .eq("staff_id", staffId)
    .eq("shift_date", workDate)
    .neq("status", "cancelled")
    .order("start_time");

  const toSlot = (start: string, end: string, shiftId: number | null): Slot => {
    const r = resolveScheduled(workDate, hhmm(start), hhmm(end), settings.timezone);
    return { start: r.start, end: r.end, shiftId };
  };

  const explicit = (shifts ?? []).filter((s) => s.start_time && s.end_time);
  if (explicit.length > 0) return explicit.map((s) => toSlot(s.start_time, s.end_time, s.id));

  if (!rota.rota_start || !rota.rota_end) return [];
  const [y, m, d] = workDate.split("-").map(Number);
  const weekday = localIsoWeekday(new Date(Date.UTC(y, m - 1, d, 12)), settings.timezone);
  if (!(rota.rota_working_days ?? [1, 2, 3, 4, 5]).includes(weekday)) return [];

  const slots = [toSlot(rota.rota_start, rota.rota_end, null)];
  if (rota.rota_start_2 && rota.rota_end_2) slots.push(toSlot(rota.rota_start_2, rota.rota_end_2, null));
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Which slot a clock-in at `at` belongs to: of the slots that haven't ended
 * yet, the one whose start is closest. So 05:58 → the 06:00 shift, 16:55 →
 * the 17:00 shift, and popping back in at 08:00 → still the 06:00 shift.
 * Null when every slot is already over (an unscheduled extra session).
 */
export function pickSlot(slots: Slot[], at: Date): Slot | null {
  const t = at.getTime();
  let best: Slot | null = null;
  for (const s of slots) {
    if (s.end.getTime() <= t) continue;
    if (!best || Math.abs(s.start.getTime() - t) < Math.abs(best.start.getTime() - t)) best = s;
  }
  return best;
}

/** How long after a shift's scheduled end an open session counts as a forgotten clock-out. */
export const FORGOT_AFTER_MS = 60 * 60_000;
/** How early before their next shift someone can arrive and still be clocked in for it. */
export const NEXT_SHIFT_EARLY_MS = 2 * 60 * 60_000;

/**
 * Split-shift safety net. `open` is the person's still-open session; `slots`
 * are today's scheduled blocks. If that session's shift ended over an hour
 * ago and a later shift is about to start (or has started), they almost
 * certainly forgot to clock out — return the next slot so the caller can
 * close the old session at its scheduled end and clock them in, instead of
 * clocking them out with hours they never worked.
 */
export function forgottenClockOut(
  open: { clock_in: string; scheduled_end: string | null },
  slots: Slot[],
  now: Date,
): Slot | null {
  if (!open.scheduled_end) return null;
  const end = new Date(open.scheduled_end).getTime();
  const t = now.getTime();
  if (t < end + FORGOT_AFTER_MS) return null;
  // closing at the scheduled end only makes sense if they clocked in before it
  if (new Date(open.clock_in).getTime() >= end) return null;
  return (
    slots.find(
      (s) => s.start.getTime() > end && t >= s.start.getTime() - NEXT_SHIFT_EARLY_MS && t < s.end.getTime(),
    ) ?? null
  );
}

/**
 * The schedule that applies to a staff member on `workDate` at instant `at`
 * (the clock-in time). On a split-shift day `at` picks which shift; without
 * it the first shift of the day is used. Returns nulls for scheduledStart
 * when nothing is scheduled — the time engine then skips lateness.
 */
export async function resolveScheduleFor(
  businessId: number,
  staffId: number,
  workDate: string,
  rota: StaffRota,
  settings: AttendanceSettings,
  at?: Date,
): Promise<ResolvedSchedule> {
  const grace =
    rota.rota_grace_minutes != null ? rota.rota_grace_minutes : settings.defaultGraceMinutes;
  const slots = await scheduleSlotsFor(businessId, staffId, workDate, rota, settings);
  const slot = at ? pickSlot(slots, at) : (slots[0] ?? null);
  return {
    scheduledStart: slot?.start ?? null,
    scheduledEnd: slot?.end ?? null,
    breakMinutes: rota.rota_break_minutes ?? 0,
    graceMinutes: grace,
    shiftId: slot?.shiftId ?? null,
  };
}
