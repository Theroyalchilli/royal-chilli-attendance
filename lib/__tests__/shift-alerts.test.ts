import { dueShiftAlerts, type AttRow, type ShiftRow } from "../shift-alerts";

// Mon 5 Oct 2026 is BST (UTC+1): "17:00" UK = 16:00 UTC.
const uk = (hh: number, mm = 0, day = 5) => new Date(Date.UTC(2026, 9, day, hh - 1, mm));
const shift: ShiftRow = { id: 7, staff_id: 3, shift_date: "2026-10-05", start_time: "17:00:00", end_time: "22:00:00" };

const run = (now: Date, attendance: AttRow[] = [], sent: string[] = [], onLeave = false) =>
  dueShiftAlerts({ now, tz: "Europe/London", shifts: [shift], attendance, alreadySent: new Set(sent), onLeave: () => onLeave }).map((a) => a.kind);

const clockedIn = (at: Date, out: Date | null = null): AttRow => ({ staff_id: 3, shift_id: 7, clock_in: at.toISOString(), clock_out: out?.toISOString() ?? null });

describe("shift alerts", () => {
  it("15 minutes before: remind to clock in", () => {
    expect(run(uk(16, 45))).toEqual(["before_start"]);
    expect(run(uk(16, 50))).toEqual(["before_start"]);
    expect(run(uk(16, 40))).toEqual([]); // too early
  });
  it("no reminder if they're already in", () => {
    expect(run(uk(16, 50), [clockedIn(uk(16, 48))])).toEqual([]);
  });
  it("5 minutes after start and not in → not_clocked_in", () => {
    expect(run(uk(17, 5))).toEqual(["not_clocked_in"]);
    expect(run(uk(17, 3))).toEqual([]);
    expect(run(uk(17, 5), [clockedIn(uk(17, 2))])).toEqual([]);
  });
  it("10 minutes after the end and still clocked in → forgot_clock_out", () => {
    expect(run(uk(22, 10), [clockedIn(uk(16, 58))])).toEqual(["forgot_clock_out"]);
    expect(run(uk(22, 5), [clockedIn(uk(16, 58))])).toEqual([]);
    expect(run(uk(22, 10), [clockedIn(uk(16, 58), uk(22, 2))])).toEqual([]); // clocked out
  });
  it("each alert only once, and none while on leave", () => {
    expect(run(uk(17, 5), [], ["7:not_clocked_in"])).toEqual([]);
    expect(run(uk(17, 5), [], [], true)).toEqual([]);
  });
  it("hours later (timer was down) → nothing stale", () => {
    expect(run(uk(19, 0))).toEqual([]);
    expect(run(uk(23, 30, 5), [clockedIn(uk(16, 58))])).toEqual(["forgot_clock_out"]);
    expect(run(uk(2, 0, 6), [clockedIn(uk(16, 58))])).toEqual([]);
  });
  it("overnight shift ending at midnight", () => {
    const late: ShiftRow = { ...shift, id: 8, start_time: "17:00:00", end_time: "00:00:00" };
    const kinds = dueShiftAlerts({
      now: uk(0, 10, 6), tz: "Europe/London", shifts: [late],
      attendance: [{ staff_id: 3, shift_id: 8, clock_in: uk(16, 58).toISOString(), clock_out: null }],
      alreadySent: new Set(), onLeave: () => false,
    }).map((a) => a.kind);
    expect(kinds).toEqual(["forgot_clock_out"]);
  });
});
