import { computeShift, resolveScheduled, weeklyOvertime } from "../time-engine";

const H = 3600;
// UTC instant helper. June 2026 → BST (+1), so utc(8) == 09:00 BST.
const utc = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h, mi));

describe("computeShift", () => {
  test("basic 9-to-5, one hour unpaid lunch", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 16),
      breaks: [{ start: utc(2026, 6, 1, 12), end: utc(2026, 6, 1, 13), isPaid: false }],
    });
    expect(r.netWorkSeconds).toBe(7 * H);
    expect(r.unpaidBreakSeconds).toBe(1 * H);
    expect(r.totalBreakSeconds).toBe(1 * H);
    expect(r.openShift).toBe(false);
  });

  test("paid break counts as worked time", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 16),
      breaks: [{ start: utc(2026, 6, 1, 10), end: utc(2026, 6, 1, 10, 15), isPaid: true }],
    });
    expect(r.netWorkSeconds).toBe(8 * H);
    expect(r.paidBreakSeconds).toBe(15 * 60);
  });

  test("overnight shift across midnight", () => {
    const r = computeShift({ clockIn: utc(2026, 6, 1, 21), clockOut: utc(2026, 6, 2, 5) });
    expect(r.netWorkSeconds).toBe(8 * H);
    expect(r.isOvernight).toBe(true);
  });

  test("DST spring forward — real elapsed is shorter than wall clock", () => {
    // UK clocks jump 01:00→02:00 on 2026-03-29. 00:30→03:30 wall = 3h, 2h real.
    const r = computeShift({
      clockIn: "2026-03-29T00:30:00+00:00", // GMT
      clockOut: "2026-03-29T03:30:00+01:00", // BST
    });
    expect(r.netWorkSeconds).toBe(2 * H);
  });

  test("DST fall back — real elapsed is longer than wall clock", () => {
    // UK clocks go 02:00→01:00 on 2026-10-25. 00:30→02:30 wall = 2h, 3h real.
    const r = computeShift({
      clockIn: "2026-10-25T00:30:00+01:00", // BST
      clockOut: "2026-10-25T02:30:00+00:00", // GMT
    });
    expect(r.netWorkSeconds).toBe(3 * H);
  });

  test("grace period: within grace on time, beyond grace late from scheduled start", () => {
    const sched = utc(2026, 6, 1, 8);
    const grace = 10 * 60;
    const onTime = computeShift({
      clockIn: utc(2026, 6, 1, 8, 7),
      clockOut: utc(2026, 6, 1, 16),
      scheduledStart: sched,
      graceSeconds: grace,
    });
    expect(onTime.isLate).toBe(false);
    expect(onTime.lateSeconds).toBe(0);

    const late = computeShift({
      clockIn: utc(2026, 6, 1, 8, 15),
      clockOut: utc(2026, 6, 1, 16),
      scheduledStart: sched,
      graceSeconds: grace,
    });
    expect(late.isLate).toBe(true);
    expect(late.lateSeconds).toBe(15 * 60);
  });

  test("early departure", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 15),
      scheduledEnd: utc(2026, 6, 1, 16),
    });
    expect(r.earlyDepartureSeconds).toBe(1 * H);
  });

  test("daily overtime split", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 18),
      dailyOvertimeThresholdSeconds: 8 * H,
    });
    expect(r.regularSeconds).toBe(8 * H);
    expect(r.overtimeSeconds).toBe(2 * H);
  });

  test("open shift running time", () => {
    const r = computeShift({ clockIn: utc(2026, 6, 1, 8), clockOut: null, now: utc(2026, 6, 1, 11) });
    expect(r.openShift).toBe(true);
    expect(r.netWorkSeconds).toBe(3 * H);
  });

  test("forgotten break is flagged and capped at clock-out", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 16),
      breaks: [{ start: utc(2026, 6, 1, 12), end: null, isPaid: false }],
    });
    expect(r.flaggedOpenBreak).toBe(true);
    expect(r.unpaidBreakSeconds).toBe(4 * H);
    expect(r.netWorkSeconds).toBe(4 * H);
  });

  test("auto-deduct break with no punches (current model)", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 19), // 11h gross
      autoDeductBreakSeconds: 45 * 60,
    });
    expect(r.netWorkSeconds).toBe(11 * H - 45 * 60);
    expect(r.autoBreakSeconds).toBe(45 * 60);
    expect(r.totalBreakSeconds).toBe(45 * 60);
  });

  test("manager adjustment applied and reported", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 15, 30), // 7h30 gross
      autoDeductBreakSeconds: 30 * 60, // → 7h00
      adjustmentSeconds: 30 * 60, // → 7h30
    });
    expect(r.netWorkSeconds).toBe(7 * H + 30 * 60);
    expect(r.adjustmentSeconds).toBe(30 * 60);
  });

  test("break + negative adjustment clamp at zero", () => {
    const r = computeShift({
      clockIn: utc(2026, 6, 1, 8),
      clockOut: utc(2026, 6, 1, 8, 20),
      autoDeductBreakSeconds: 30 * 60,
      adjustmentSeconds: -99 * 60,
    });
    expect(r.netWorkSeconds).toBe(0);
  });

  test("clock-out before clock-in throws", () => {
    expect(() => computeShift({ clockIn: utc(2026, 6, 1, 16), clockOut: utc(2026, 6, 1, 8) })).toThrow();
  });

  test("ISO string without a timezone offset is rejected", () => {
    expect(() =>
      computeShift({ clockIn: "2026-06-01T09:00:00", clockOut: utc(2026, 6, 1, 16) }),
    ).toThrow();
  });
});

describe("resolveScheduled", () => {
  test("overnight flag + 8h span", () => {
    const { start, end, isOvernight } = resolveScheduled("2026-06-01", "22:00", "06:00", "Europe/London");
    expect(isOvernight).toBe(true);
    expect((end.getTime() - start.getTime()) / H / 1000).toBe(8);
  });

  test("day shift resolves to the right UTC instant (BST)", () => {
    const { start } = resolveScheduled("2026-06-01", "09:00", "17:00", "Europe/London");
    expect(start.toISOString()).toBe("2026-06-01T08:00:00.000Z");
  });
});

describe("weeklyOvertime", () => {
  test("on top of daily", () => {
    expect(weeklyOvertime([9 * H, 9 * H, 9 * H, 9 * H, 9 * H], 40 * H)).toBe(5 * H);
  });
});
