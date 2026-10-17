// The "Choose…" menu on a rota shift nobody has clocked against (Admin →
// Attendance), agreed 2026-10-17. Pure — used by the page and its tests.

/** A no-show can be recorded this long after the shift's start. */
export const ABSENT_AFTER_MINUTES = 30;

/** Leave a manager can record for one shift's day, straight from Attendance. */
export const SHIFT_LEAVE_TYPES = ["sick", "holiday", "unpaid"] as const;
export type ShiftLeaveType = (typeof SHIFT_LEAVE_TYPES)[number];
export const LEAVE_TYPE_LABEL: Record<ShiftLeaveType, string> = { sick: "Sick", holiday: "Holiday", unpaid: "Unpaid leave" };

export type ShiftAction = "clock_in" | "absent" | ShiftLeaveType | "cancel" | "undo";

export type ShiftForActions = {
  state: "pending" | "absent" | "leave" | "holiday" | "request_pending" | "cancelled";
  status: string; // classifyShiftStatus: "Upcoming" | "Not in" | "Stuck" | …
  canMarkAbsent: boolean;
  ended: boolean;
  canUndo: boolean;
};

export function shiftActions(p: ShiftForActions): { key: ShiftAction; label: string }[] {
  if (p.state !== "pending") return p.canUndo ? [{ key: "undo", label: "↩️ Undo" }] : [];
  const out: { key: ShiftAction; label: string }[] = [];
  if (p.status !== "Upcoming") out.push({ key: "clock_in", label: p.ended ? "✅ Add worked times" : "✅ Clock in now" });
  if (p.canMarkAbsent) out.push({ key: "absent", label: "❌ Absent (no show)" });
  out.push(
    { key: "sick", label: "🤒 Sick" },
    { key: "holiday", label: "🏖 Holiday" },
    { key: "unpaid", label: "💷 Unpaid leave" },
    { key: "cancel", label: "🚫 Shift not needed" },
  );
  return out;
}
