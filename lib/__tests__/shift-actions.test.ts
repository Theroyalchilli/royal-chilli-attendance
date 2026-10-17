import { shiftActions, type ShiftForActions } from "../shift-actions";

const keys = (p: Partial<ShiftForActions>) =>
  shiftActions({ state: "pending", status: "Not in", canMarkAbsent: false, ended: false, canUndo: false, ...p }).map((a) => a.key);

describe("Attendance 'Choose…' menu", () => {
  test("later today: leave or not needed only (no clock-in, no absent)", () => {
    expect(keys({ status: "Upcoming" })).toEqual(["sick", "holiday", "unpaid", "cancel"]);
  });
  test("started, under 30 min: clock in now, leave, not needed", () => {
    expect(keys({})).toEqual(["clock_in", "sick", "holiday", "unpaid", "cancel"]);
  });
  test("30 min after the start: absent is offered too", () => {
    expect(keys({ canMarkAbsent: true })).toEqual(["clock_in", "absent", "sick", "holiday", "unpaid", "cancel"]);
  });
  test("after the end the clock-in choice adds worked times", () => {
    const list = shiftActions({ state: "pending", status: "Not in", canMarkAbsent: true, ended: true, canUndo: false });
    expect(list[0]).toEqual({ key: "clock_in", label: "✅ Add worked times" });
  });
  test("absent / sick / holiday / not needed: just Undo", () => {
    for (const state of ["absent", "leave", "holiday", "cancelled"] as const) {
      expect(keys({ state, canUndo: true })).toEqual(["undo"]);
    }
  });
  test("leave over several days or a staff request: nothing here (Leave page)", () => {
    expect(keys({ state: "leave", canUndo: false })).toEqual([]);
    expect(keys({ state: "request_pending" })).toEqual([]);
  });
});
