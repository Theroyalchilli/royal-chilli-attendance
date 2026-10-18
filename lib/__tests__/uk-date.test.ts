import { addDays, mondayOf, monthRange, ukMonday, ukToday } from "../uk-date";

describe("UK dates", () => {
  // 00:19 on Monday 19 Oct 2026 in the UK (British Summer Time) is still
  // Sunday 18 Oct in UTC — the moment the rota showed "Mon 18".
  const justAfterMidnight = new Date("2026-10-18T23:19:00Z");

  it("today is the UK date, not the UTC one", () => {
    expect(ukToday(justAfterMidnight)).toBe("2026-10-19");
  });

  it("this week starts on the real Monday just after midnight", () => {
    expect(ukMonday(justAfterMidnight)).toBe("2026-10-19");
  });

  it("works in winter (GMT) too", () => {
    expect(ukToday(new Date("2026-12-07T00:30:00Z"))).toBe("2026-12-07");
    expect(ukMonday(new Date("2026-12-13T23:30:00Z"))).toBe("2026-12-07"); // Sun 13 Dec, 23:30
  });

  it("finds the Monday of any day, Sunday included", () => {
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // Sunday → previous Monday
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // clock-change Sunday
  });

  it("adds days across month ends and the clock change", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("gives a whole month, last day included", () => {
    expect(monthRange("2026-10-19")).toEqual(["2026-10-01", "2026-10-31"]);
    expect(monthRange("2026-10-19", -1)).toEqual(["2026-09-01", "2026-09-30"]);
    expect(monthRange("2026-01-15", -1)).toEqual(["2025-12-01", "2025-12-31"]);
    expect(monthRange("2028-02-10")).toEqual(["2028-02-01", "2028-02-29"]);
  });
});
