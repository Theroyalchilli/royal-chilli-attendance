import { hm, hoursMinutes, roundedShiftSeconds } from "../format";

describe("a shift's hours rounded to the half hour (Timesheets only)", () => {
  const h = (hrs: number, mins: number) => hrs * 3600 + mins * 60;
  it.each([
    [h(7, 0), h(7, 0)],
    [h(7, 14), h(7, 0)],
    [h(7, 15), h(7, 30)],
    [h(7, 16), h(7, 30)],
    [h(7, 36), h(7, 30)],
    [h(7, 43), h(7, 30)],
    [h(7, 44), h(7, 30)],
    [h(7, 45), h(8, 0)],
    [h(7, 50), h(8, 0)],
    [h(7, 54), h(8, 0)],
    [h(12, 20), h(12, 30)],
    [h(6, 7), h(6, 0)],
    [h(23, 54), h(24, 0)],
  ])("%i seconds → %i", (worked, rounded) => {
    expect(roundedShiftSeconds(worked)).toBe(rounded);
  });
  it("uses the minutes hm() shows: 7h 14m 40s reads 7h 15m, so → 7h 30m", () => {
    expect(hm(h(7, 14) + 40)).toBe("7h 15m");
    expect(roundedShiftSeconds(h(7, 14) + 40)).toBe(h(7, 30));
  });
  it("nothing → 0, and 10m → 0", () => {
    expect(roundedShiftSeconds(null)).toBe(0);
    expect(roundedShiftSeconds(10 * 60)).toBe(0);
  });
});

describe("staff hours as hours and minutes", () => {
  it("Anusha, 9 Oct: 9h 49m from seconds or from payroll's 9.82", () => {
    expect(hm(9 * 3600 + 49 * 60)).toBe("9h 49m");
    expect(hoursMinutes(9.82)).toBe("9h 49m");
  });
  it("whole hours, minutes only, nothing", () => {
    expect(hm(8 * 3600)).toBe("8h");
    expect(hm(30 * 60)).toBe("30m");
    expect(hm(null)).toBe("0m");
  });
  it("3599 seconds is 1h, never 60m", () => {
    expect(hm(3599)).toBe("1h");
    expect(hm(2 * 3600 + 3599)).toBe("3h");
  });
});
