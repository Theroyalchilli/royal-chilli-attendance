import supabase from "./supabase";

// Attendance config lives in the shared app_settings table (JSONB values),
// seeded by POS migration 030. Cached briefly per server instance.
const KEYS = [
  "attendance_timezone",
  "attendance_overtime_enabled",
  "attendance_overtime_daily_minutes",
  "attendance_overtime_multiplier",
  "attendance_rounding_minutes",
  "attendance_default_grace_minutes",
  "attendance_photo_retention_days",
  "attendance_kiosk_pin_max_attempts",
  "attendance_kiosk_pin_lockout_minutes",
  "attendance_missing_clockout_hours",
] as const;

export type AttendanceSettings = {
  timezone: string;
  overtimeEnabled: boolean;
  overtimeDailyMinutes: number;
  overtimeMultiplier: number;
  roundingMinutes: number;
  defaultGraceMinutes: number;
  photoRetentionDays: number;
  kioskPinMaxAttempts: number;
  kioskPinLockoutMinutes: number;
  missingClockoutHours: number;
};

const DEFAULTS: AttendanceSettings = {
  timezone: "Europe/London",
  overtimeEnabled: false,
  overtimeDailyMinutes: 0,
  overtimeMultiplier: 1.5,
  roundingMinutes: 0,
  defaultGraceMinutes: 5,
  photoRetentionDays: 60,
  kioskPinMaxAttempts: 5,
  kioskPinLockoutMinutes: 5,
  missingClockoutHours: 16,
};

let cache: { at: number; value: AttendanceSettings } | null = null;
const TTL_MS = 30_000;

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const { data } = await supabase.from("app_settings").select("key, value").in("key", KEYS as unknown as string[]);
  const m = new Map<string, unknown>((data ?? []).map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const v = m.get(k);
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : d;
  };
  const bool = (k: string, d: boolean) => {
    const v = m.get(k);
    return typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : d;
  };

  const value: AttendanceSettings = {
    timezone: (m.get("attendance_timezone") as string) || DEFAULTS.timezone,
    overtimeEnabled: bool("attendance_overtime_enabled", DEFAULTS.overtimeEnabled),
    overtimeDailyMinutes: num("attendance_overtime_daily_minutes", DEFAULTS.overtimeDailyMinutes),
    overtimeMultiplier: num("attendance_overtime_multiplier", DEFAULTS.overtimeMultiplier),
    roundingMinutes: num("attendance_rounding_minutes", DEFAULTS.roundingMinutes),
    defaultGraceMinutes: num("attendance_default_grace_minutes", DEFAULTS.defaultGraceMinutes),
    photoRetentionDays: num("attendance_photo_retention_days", DEFAULTS.photoRetentionDays),
    kioskPinMaxAttempts: num("attendance_kiosk_pin_max_attempts", DEFAULTS.kioskPinMaxAttempts),
    kioskPinLockoutMinutes: num("attendance_kiosk_pin_lockout_minutes", DEFAULTS.kioskPinLockoutMinutes),
    missingClockoutHours: num("attendance_missing_clockout_hours", DEFAULTS.missingClockoutHours),
  };
  cache = { at: Date.now(), value };
  return value;
}

/** "YYYY-MM-DD" for an instant in the given IANA timezone. */
export function localDateString(instant: Date, tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return p; // en-CA formats as YYYY-MM-DD
}

/** ISO weekday for an instant in tz: 1 = Mon .. 7 = Sun. */
export function localIsoWeekday(instant: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(instant);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[wd] ?? 1;
}
