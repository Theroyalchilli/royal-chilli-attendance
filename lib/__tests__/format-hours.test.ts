import { hm, hoursMinutes } from "../format";

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
