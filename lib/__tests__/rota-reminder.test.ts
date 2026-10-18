jest.mock("../supabase", () => ({ __esModule: true, default: {} }));
jest.mock("../push", () => ({}));
import { nextWeek, rotaReminderText } from "../rota-reminder";

describe("next week's rota reminder", () => {
  it("next week is the coming Monday–Sunday (UK dates)", () => {
    // Friday 23 Oct 2026, 12:00 UTC (13:00 UK).
    expect(nextWeek(new Date("2026-10-23T12:00:00Z"))).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    // Sunday 25 Oct 2026, 18:00 UTC (GMT from that morning) — still the week from Mon 26.
    expect(nextWeek(new Date("2026-10-25T18:00:00Z"))).toEqual({ from: "2026-10-26", to: "2026-11-01" });
  });

  it("names the week in the messages", () => {
    expect(rotaReminderText("first", "The Royal Chilli", "2026-10-26")).toContain("from Mon 26 Oct");
    const last = rotaReminderText("final", "The Royal Chilli", "2026-10-26");
    expect(last).toContain("The Royal Chilli");
    expect(last).toContain("starts tomorrow");
  });
});
