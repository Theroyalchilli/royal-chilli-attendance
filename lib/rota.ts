import supabase from "./supabase";
import { resolveScheduled } from "./time-engine";
import { localIsoWeekday, type AttendanceSettings } from "./settings";

export type StaffRota = {
  rota_start: string | null; // "HH:MM:SS"
  rota_end: string | null;
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

const hhmm = (t: string) => t.slice(0, 5); // "09:00:00" -> "09:00"

/**
 * The schedule that applies to a staff member on `workDate` ("YYYY-MM-DD"):
 * an explicit `shifts` row for that date wins; otherwise the personal rota
 * default on `staff` (if it's a working day). Returns nulls for scheduledStart
 * when there's nothing scheduled — the time engine then skips lateness.
 */
export async function resolveScheduleFor(
  staffId: number,
  workDate: string,
  rota: StaffRota,
  settings: AttendanceSettings,
): Promise<ResolvedSchedule> {
  const grace =
    rota.rota_grace_minutes != null ? rota.rota_grace_minutes : settings.defaultGraceMinutes;

  // 1. explicit published shift for the day
  const { data: shift } = await supabase
    .from("shifts")
    .select("id, start_time, end_time")
    .eq("staff_id", staffId)
    .eq("shift_date", workDate)
    .neq("status", "cancelled")
    .order("start_time")
    .limit(1)
    .maybeSingle();

  if (shift?.start_time && shift?.end_time) {
    const { start, end } = resolveScheduled(
      workDate,
      hhmm(shift.start_time),
      hhmm(shift.end_time),
      settings.timezone,
    );
    return {
      scheduledStart: start,
      scheduledEnd: end,
      breakMinutes: rota.rota_break_minutes ?? 0,
      graceMinutes: grace,
      shiftId: shift.id,
    };
  }

  // 2. personal rota default, only on a working weekday
  if (rota.rota_start && rota.rota_end) {
    const [y, m, d] = workDate.split("-").map(Number);
    const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));
    const weekday = localIsoWeekday(noonUtc, settings.timezone);
    const workingDays = rota.rota_working_days ?? [1, 2, 3, 4, 5];
    if (workingDays.includes(weekday)) {
      const { start, end } = resolveScheduled(
        workDate,
        hhmm(rota.rota_start),
        hhmm(rota.rota_end),
        settings.timezone,
      );
      return {
        scheduledStart: start,
        scheduledEnd: end,
        breakMinutes: rota.rota_break_minutes ?? 0,
        graceMinutes: grace,
        shiftId: null,
      };
    }
  }

  // 3. nothing scheduled
  return {
    scheduledStart: null,
    scheduledEnd: null,
    breakMinutes: rota.rota_break_minutes ?? 0,
    graceMinutes: grace,
    shiftId: null,
  };
}
