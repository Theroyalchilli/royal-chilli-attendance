import { computeShift, type ShiftResult } from "./time-engine";
import type { AttendanceSettings } from "./settings";
import supabase from "./supabase";

export type RecomputeInput = {
  clockIn: string | null;
  clockOut: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  breakOverrideMinutes: number | null;
  adjustmentSeconds: number;
  /** effective break when there's no override — from the resolved schedule */
  scheduleBreakMinutes: number;
  graceSeconds: number;
  now?: Date;
};

/** The derived-seconds columns the time engine owns on an attendance row. */
export type DerivedPatch = {
  break_seconds: number;
  net_work_seconds: number;
  regular_seconds: number;
  overtime_seconds: number;
  late_seconds: number;
  early_departure_seconds: number;
  is_overnight: boolean;
};

/** UK rest-break rule: the rota break is only owed on a session over 6 hours. */
export const BREAK_MIN_SESSION_SECONDS = 6 * 3600;

export function recompute(inp: RecomputeInput, settings: AttendanceSettings): { patch: DerivedPatch; result: ShiftResult } {
  // A manager's per-day override always wins. Otherwise the rota break only
  // comes off a session longer than 6h — so on a split-shift day the short
  // 06:00–10:00 half keeps all its hours and only the long half loses the break.
  const until = inp.clockOut ? new Date(inp.clockOut) : (inp.now ?? new Date());
  const sessionSeconds = inp.clockIn ? (until.getTime() - new Date(inp.clockIn).getTime()) / 1000 : 0;
  const breakMinutes =
    inp.breakOverrideMinutes ?? (sessionSeconds > BREAK_MIN_SESSION_SECONDS ? inp.scheduleBreakMinutes : 0);
  const otThreshold =
    settings.overtimeEnabled && settings.overtimeDailyMinutes > 0
      ? settings.overtimeDailyMinutes * 60
      : null;

  const result = computeShift({
    clockIn: inp.clockIn,
    clockOut: inp.clockOut,
    scheduledStart: inp.scheduledStart,
    scheduledEnd: inp.scheduledEnd,
    graceSeconds: inp.graceSeconds,
    autoDeductBreakSeconds: Math.max(0, breakMinutes) * 60,
    adjustmentSeconds: inp.adjustmentSeconds,
    dailyOvertimeThresholdSeconds: otThreshold,
    now: inp.clockOut ? null : (inp.now ?? new Date()),
  });

  return {
    result,
    patch: {
      break_seconds: result.totalBreakSeconds,
      net_work_seconds: result.netWorkSeconds,
      regular_seconds: result.regularSeconds,
      overtime_seconds: result.overtimeSeconds,
      late_seconds: result.lateSeconds,
      early_departure_seconds: result.earlyDepartureSeconds,
      is_overnight: result.isOvernight,
    },
  };
}

/** Append-only old→new row in the POS's shared audit_logs. Best-effort. */
export async function audit(
  staffId: number | null,
  action: string,
  entityId: number,
  oldValue: unknown,
  newValue: unknown,
) {
  try {
    const row = (newValue ?? oldValue) as { business_id?: number } | null;
    await supabase.from("audit_logs").insert({
      ...(row?.business_id ? { business_id: row.business_id } : {}),
      staff_id: staffId,
      action,
      entity_type: "attendance",
      entity_id: entityId,
      changes: { old: oldValue ?? null, new: newValue ?? null },
    });
  } catch (e) {
    console.error("audit write failed:", e);
  }
}
