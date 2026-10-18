jest.mock("../supabase", () => ({ __esModule: true, default: {} }));
import { distanceMeters, formatDistance, judgeLocation } from "../geofence";

// The Royal Chilli's saved point and its 150m clock-in radius.
const R = { lat: 51.471985, lng: -0.355561, radius: 150 };

describe("clock-in location check", () => {
  it("lets in a good reading inside the radius", () => {
    expect(judgeLocation(60, R.radius, 12)).toMatchObject({ ok: true });
  });

  it("lets in an indoor reading that drifted just outside, within its own error margin", () => {
    // 210m away but the phone says ±80m: could easily be inside.
    expect(judgeLocation(210, R.radius, 80)).toMatchObject({ ok: true });
  });

  it("caps the margin, so a vague reading can't stretch the radius far", () => {
    expect(judgeLocation(300, R.radius, 200)).toMatchObject({ ok: false, reason: "out_of_range" });
  });

  it("says the location is rough, not 'miles away', when the phone only has a rough fix", () => {
    // iPhone with Precise Location off, or a phone-mast guess indoors.
    expect(judgeLocation(2400, R.radius, 3000)).toMatchObject({ ok: false, reason: "rough_location", accuracy: 3000 });
  });

  it("still refuses someone really far away with an accurate reading", () => {
    expect(judgeLocation(2400, R.radius, 15)).toMatchObject({ ok: false, reason: "out_of_range", distance: 2400 });
  });

  it("works without an accuracy figure (older app version)", () => {
    expect(judgeLocation(100, R.radius, null)).toMatchObject({ ok: true });
    expect(judgeLocation(400, R.radius, null)).toMatchObject({ ok: false, reason: "out_of_range" });
  });

  it("measures distance on the map", () => {
    // ~0.001° of latitude is ~111m.
    expect(distanceMeters(R.lat, R.lng, R.lat + 0.001, R.lng)).toBeGreaterThan(105);
    expect(distanceMeters(R.lat, R.lng, R.lat + 0.001, R.lng)).toBeLessThan(115);
  });

  it("writes distances in metres or km", () => {
    expect(formatDistance(85)).toBe("85m");
    expect(formatDistance(2400)).toBe("2.4 km");
  });
});
