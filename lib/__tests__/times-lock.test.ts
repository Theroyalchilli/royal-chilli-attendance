import { keepOnlyRealTimeChanges, realTimeChanges } from "../times-lock";

const row = {
  clock_in: "2026-10-05T11:03:27.000Z",
  clock_out: "2026-10-05T19:58:10.000Z",
  break_override_minutes: null,
  adjustment_seconds: 0,
};

describe("times change once — what counts as a change", () => {
  it("re-saving the edit screen unchanged is not a change (it works to the minute)", () => {
    const patch: Record<string, unknown> = {
      clock_in: "2026-10-05T11:03:00.000Z",
      clock_out: "2026-10-05T19:58:00.000Z",
      break_override_minutes: null,
      adjustment_seconds: 0,
      notes: "checked",
    };
    expect(keepOnlyRealTimeChanges(row, patch)).toEqual([]);
    // the stored seconds are kept, the note still goes through
    expect(patch).toEqual({ notes: "checked" });
  });

  it("a different minute, break or adjustment is a change", () => {
    expect(realTimeChanges(row, { clock_out: "2026-10-05T20:30:00.000Z" })).toEqual(["clock_out"]);
    expect(realTimeChanges(row, { break_override_minutes: 30 })).toEqual(["break_override_minutes"]);
    expect(realTimeChanges(row, { adjustment_seconds: -600 })).toEqual(["adjustment_seconds"]);
  });

  it("filling in a missing clock-out is a change", () => {
    expect(realTimeChanges({ ...row, clock_out: null }, { clock_out: "2026-10-05T20:00:00.000Z" })).toEqual(["clock_out"]);
  });

  it("clearing a time is a change", () => {
    expect(realTimeChanges(row, { clock_out: null })).toEqual(["clock_out"]);
  });
});
