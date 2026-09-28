jest.mock("../supabase", () => ({ __esModule: true, default: {} }));

import { forgottenClockOut, pickSlot, type Slot } from "../rota";
import { recompute } from "../attendance-write";
import { resolveScheduled } from "../time-engine";
import type { AttendanceSettings } from "../settings";

const H = 3600;
const TZ = "Europe/London";
const DAY = "2026-10-05"; // a Monday, BST (+1)

const slot = (start: string, end: string, shiftId: number | null = null): Slot => {
  const r = resolveScheduled(DAY, start, end, TZ);
  return { start: r.start, end: r.end, shiftId };
};
// wall-clock "HH:MM" on DAY (or the next day) in London → instant
const at = (hm: string, nextDay = false) => {
  const [h, m] = hm.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, nextDay ? 6 : 5, h - 1, m)); // BST = UTC+1
};

const morning = slot("06:00", "10:00", 1);
const evening = slot("17:00", "00:00", 2);
const split = [morning, evening];

describe("pickSlot — which shift a clock-in belongs to", () => {
  test("early for the morning shift", () => {
    expect(pickSlot(split, at("05:58"))?.shiftId).toBe(1);
  });
  test("a little late for the morning shift", () => {
    expect(pickSlot(split, at("06:20"))?.shiftId).toBe(1);
  });
  test("back in mid-morning → still the morning shift", () => {
    expect(pickSlot(split, at("08:00"))?.shiftId).toBe(1);
  });
  test("early for the evening shift", () => {
    expect(pickSlot(split, at("16:55"))?.shiftId).toBe(2);
  });
  test("mid-afternoon, morning over → the evening shift", () => {
    expect(pickSlot(split, at("13:00"))?.shiftId).toBe(2);
  });
  test("late for the evening shift", () => {
    expect(pickSlot(split, at("17:40"))?.shiftId).toBe(2);
  });
  test("evening shift ends at midnight — the next day", () => {
    expect(evening.end.toISOString()).toBe(at("00:00", true).toISOString());
  });
  test("every shift over → unscheduled", () => {
    expect(pickSlot(split, at("00:30", true))).toBeNull();
  });
  test("no shifts → null", () => {
    expect(pickSlot([], at("09:00"))).toBeNull();
  });
});

describe("forgottenClockOut — split-shift safety net", () => {
  const open = { clock_in: at("05:58").toISOString(), scheduled_end: morning.end.toISOString() };

  test("forgot after the morning, tapping for the evening → next shift", () => {
    expect(forgottenClockOut(open, split, at("16:55"))?.shiftId).toBe(2);
  });
  test("staying on a bit past the morning end → normal clock-out", () => {
    expect(forgottenClockOut(open, split, at("10:30"))).toBeNull();
  });
  test("long after the morning but evening still hours away → normal clock-out", () => {
    expect(forgottenClockOut(open, split, at("12:00"))).toBeNull();
  });
  test("no later shift that day → normal clock-out", () => {
    expect(forgottenClockOut(open, [morning], at("16:55"))).toBeNull();
  });
  test("unscheduled session → never auto-closed", () => {
    expect(forgottenClockOut({ clock_in: open.clock_in, scheduled_end: null }, split, at("16:55"))).toBeNull();
  });
  test("clocked in after the scheduled end → never auto-closed", () => {
    expect(forgottenClockOut({ clock_in: at("11:00").toISOString(), scheduled_end: open.scheduled_end }, split, at("16:55"))).toBeNull();
  });
});

describe("recompute — break only off shifts over 6 hours", () => {
  const settings = { overtimeEnabled: false, overtimeDailyMinutes: 0 } as AttendanceSettings;
  const run = (inH: string, outH: string, outNextDay = false, override: number | null = null) =>
    recompute(
      {
        clockIn: at(inH).toISOString(),
        clockOut: at(outH, outNextDay).toISOString(),
        scheduledStart: null,
        scheduledEnd: null,
        breakOverrideMinutes: override,
        adjustmentSeconds: 0,
        scheduleBreakMinutes: 30,
        graceSeconds: 0,
      },
      settings,
    ).patch.net_work_seconds;

  test("4h morning keeps all its hours", () => {
    expect(run("06:00", "10:00")).toBe(4 * H);
  });
  test("7h evening loses the 30 min break", () => {
    expect(run("17:00", "00:00", true)).toBe(6.5 * H);
  });
  test("exactly 6h → no break", () => {
    expect(run("09:00", "15:00")).toBe(6 * H);
  });
  test("a manager's override always applies", () => {
    expect(run("06:00", "10:00", false, 15)).toBe(3.75 * H);
  });
});
