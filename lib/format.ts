// Staff hours always read as hours and minutes ("9h 49m"), never 9.82 —
// on every screen, print and download, here and in the Staff Hub.
export function hm(seconds: number | null | undefined): string {
  const mins = Math.max(0, Math.round((seconds ?? 0) / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Decimal hours as stored on payroll rows (9.82) → "9h 49m". */
export function hoursMinutes(hours: number | null | undefined): string {
  return hm((Number(hours) || 0) * 3600);
}

export function decimalHours(seconds: number | null | undefined): number {
  return Math.round(((seconds ?? 0) / 3600) * 100) / 100;
}

export function clockTime(iso: string | null | undefined, tz = "Europe/London"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function dayLabel(iso: string, tz = "Europe/London"): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  });
}

/** Minutes an open shift has been running. */
export function runningMinutes(clockInIso: string): number {
  return Math.floor((Date.now() - new Date(clockInIso).getTime()) / 60000);
}
