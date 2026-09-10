export function hm(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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
