jest.mock("../supabase", () => ({ __esModule: true, default: {} }));

import { prefFor, withNid } from "../notification-prefs";
import { kindOf, splitNotification } from "../notification-kinds";

describe("which switch controls an alert", () => {
  it("manager messages and shift reminders are always on", () => {
    for (const t of ["staff_message", "shift_reminder", "not_clocked_in", "clock_out_reminder", "missed_clockout"]) expect(prefFor(t, "self")).toBeNull();
  });
  it("my own rota and request alerts follow my switches", () => {
    expect(prefFor("rota_ready", "self")).toBe("rota");
    expect(prefFor("shift_changed", "self")).toBe("rota");
    expect(prefFor("leave_reviewed", "self")).toBe("requests");
    expect(prefFor("correction_reviewed", "self")).toBe("requests");
  });
  it("copies to managers follow the manager switches", () => {
    expect(prefFor("not_clocked_in", "managers")).toBe("team_late");
    expect(prefFor("missed_clockout", "managers")).toBe("team_late");
    expect(prefFor("leave_submitted", "managers")).toBe("team_requests");
    expect(prefFor("staff_message", "managers")).toBeNull();
  });
});

describe("phone alert links mark the notification read", () => {
  it("adds ?nid= / &nid=", () => {
    expect(withNid("/me/rota", 12)).toBe("/me/rota?nid=12");
    expect(withNid("/admin/attendance?staff_id=3&date=2026-10-05", 12)).toBe("/admin/attendance?staff_id=3&date=2026-10-05&nid=12");
    expect(withNid(null, 12)).toBe("/me?nid=12");
    expect(withNid("https://staffhub.example/x", 12)).toBe("/me?nid=12");
  });
});

describe("notification titles", () => {
  it("uses the stored title, else the type's", () => {
    expect(splitNotification({ type: "staff_message", title: "Meeting", message: "3pm" })).toEqual({ title: "Meeting", body: "3pm" });
    expect(splitNotification({ type: "rota_ready", title: null, message: "Your rota…" })).toEqual({ title: "Your rota is ready", body: "Your rota…" });
  });
  it("older manager messages stored as 'Title — body' are split", () => {
    expect(splitNotification({ type: "staff_message", title: null, message: "Meeting — 3pm sharp" })).toEqual({ title: "Meeting", body: "3pm sharp" });
  });
  it("unknown types still get an icon", () => {
    expect(kindOf("something_new").icon).toBe("🔔");
  });
});
