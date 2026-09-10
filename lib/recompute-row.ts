import supabase from "./supabase";
import { getAttendanceSettings } from "./settings";
import { resolveScheduleFor, type StaffRota } from "./rota";
import { recompute } from "./attendance-write";

/**
 * Re-resolve the schedule for an attendance row's work date and recompute its
 * derived seconds through the time engine, then persist. Used after a manager
 * edit and after an approved correction — the single "figures can't diverge"
 * path, same idea as the Python engine's recalc.
 */
export async function recomputeAndSave(attendanceId: number): Promise<Record<string, unknown> | null> {
  const { data: row } = await supabase.from("attendance").select("*").eq("id", attendanceId).maybeSingle();
  if (!row) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes")
    .eq("id", row.staff_id)
    .maybeSingle();

  const settings = await getAttendanceSettings();
  const rota = (staff ?? {
    rota_start: null,
    rota_end: null,
    rota_working_days: null,
    rota_break_minutes: null,
    rota_grace_minutes: null,
  }) as StaffRota;

  const sched = await resolveScheduleFor(row.staff_id, row.work_date, rota, settings);

  const { patch } = recompute(
    {
      clockIn: row.clock_in,
      clockOut: row.clock_out,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      breakOverrideMinutes: row.break_override_minutes,
      adjustmentSeconds: row.adjustment_seconds ?? 0,
      scheduleBreakMinutes: sched.breakMinutes,
      graceSeconds: sched.graceMinutes * 60,
    },
    settings,
  );

  const nextStatus = row.clock_in && row.clock_out ? "clocked_out" : row.clock_in ? "clocked_in" : row.status;

  const { data: updated } = await supabase
    .from("attendance")
    .update({ ...patch, status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", attendanceId)
    .select()
    .single();

  return updated;
}
