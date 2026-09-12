// Shared "friendly" shift-status classification — used by the manager
// dashboard's Rota card, the Attendance day view's pending rows, and the
// Reports "Today" tab, so the same person's status always reads the same
// way everywhere instead of three slightly different labels.

export type ShiftStatus = "On Shift" | "Done" | "Upcoming" | "Not in" | "Absent" | "Stuck";

/**
 * `nowHM`/`startHM`/`endHM` are "HH:MM" wall-clock strings in the workplace
 * timezone. `workDate`/`today` are "YYYY-MM-DD". `hasOpenShift` = an
 * attendance row with clock_in set and clock_out still null, for THIS
 * work_date. `hasClosedShift` = an attendance row with clock_out set for
 * that day. `hasStaleOpenShift` = they have an open clock-in *somewhere*
 * (any date) older than the missing-clockout threshold — a forgotten
 * clock-out, not a real "currently working" signal, so it must never read
 * as "On Shift" just because some row, however old, is still unclosed.
 */
export function classifyShiftStatus(args: {
  workDate: string;
  today: string;
  startHM: string;
  nowHM: string;
  hasOpenShift: boolean;
  hasClosedShift: boolean;
  hasStaleOpenShift?: boolean;
}): ShiftStatus {
  const { workDate, today, startHM, nowHM, hasOpenShift, hasClosedShift, hasStaleOpenShift } = args;
  if (hasStaleOpenShift) return "Stuck";
  if (hasOpenShift) return "On Shift";
  if (hasClosedShift) return "Done";
  if (workDate < today) return "Absent"; // a past day with a shift but no attendance at all
  if (workDate > today) return "Upcoming"; // hasn't arrived yet, nothing to check
  return startHM > nowHM ? "Upcoming" : "Not in";
}

export const SHIFT_STATUS_BADGE: Record<ShiftStatus, string> = {
  "On Shift": "bg-emerald-100 text-emerald-700",
  Done: "bg-neutral-100 text-neutral-500",
  Upcoming: "bg-blue-100 text-blue-700",
  "Not in": "bg-amber-100 text-amber-700",
  Absent: "bg-red-100 text-red-700",
  Stuck: "bg-red-100 text-red-700",
};

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  "On Shift": "On Shift",
  Done: "Done",
  Upcoming: "Upcoming",
  "Not in": "Pending clock-in",
  Absent: "Absent",
  Stuck: "Forgotten clock-out",
};
