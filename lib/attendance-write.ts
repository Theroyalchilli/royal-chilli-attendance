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

export function recompute(inp: RecomputeInput, settings: AttendanceSettings): { patch: DerivedPatch; result: ShiftResult } {
  const breakMinutes = inp.breakOverrideMinutes ?? inp.scheduleBreakMinutes;
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
    await supabase.from("audit_logs").insert({
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
