// A shift's times can be changed ONCE — by an approved correction or a manager
// edit — then they're locked for everyone (migration 110 in the POS repo,
// which also guards it in the database). Kiosk punches aren't changes.

export const TIME_FIELDS = ["clock_in", "clock_out", "break_override_minutes", "adjustment_seconds"] as const;

export const LOCKED_MESSAGE = "This shift's times have already been changed once. They're locked and can't be changed again.";

// The edit screens work to the minute, so 12:03:27 sent back as 12:03 is not a change.
const minuteOf = (v: unknown) => (v ? Math.floor(new Date(v as string).getTime() / 60000) : null);

/** Which of the time fields in `patch` really differ from the row. */
export function realTimeChanges(before: Record<string, unknown>, patch: Record<string, unknown>): string[] {
  return TIME_FIELDS.filter((k) => {
    if (!(k in patch)) return false;
    if (k === "clock_in" || k === "clock_out") return minuteOf(patch[k]) !== minuteOf(before[k]);
    if (k === "adjustment_seconds") return Number(patch[k] ?? 0) !== Number(before[k] ?? 0);
    return (patch[k] ?? null) !== (before[k] ?? null);
  });
}

/** Drop the time fields that aren't real changes, so they keep their exact stored value. */
export function keepOnlyRealTimeChanges(before: Record<string, unknown>, patch: Record<string, unknown>): string[] {
  const changed = realTimeChanges(before, patch);
  for (const k of TIME_FIELDS) if (k in patch && !changed.includes(k)) delete patch[k];
  return changed;
}
