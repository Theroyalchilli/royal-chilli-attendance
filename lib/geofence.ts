import { getAttendanceSettings } from "./settings";

/** Great-circle distance in metres between two lat/lng points. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export type GeoCheck =
  | { ok: true; enforced: boolean; distance?: number }
  | { ok: false; reason: "no_location" | "out_of_range" | "not_configured"; distance?: number; radius?: number };

/**
 * Check a clock punch's location against the restaurant geofence.
 * Disabled → always ok (not enforced). Enabled but no coords set → ok but a
 * warning ("not_configured" is only returned when enabled and missing coords
 * AND a location was supplied — we don't want to hard-block on misconfig).
 */
export async function checkGeofence(lat: number | null, lng: number | null): Promise<GeoCheck> {
  const s = await getAttendanceSettings();
  if (!s.geofenceEnabled) return { ok: true, enforced: false };
  if (s.restaurantLat == null || s.restaurantLng == null) return { ok: true, enforced: false };

  if (lat == null || lng == null) return { ok: false, reason: "no_location" };

  const distance = distanceMeters(lat, lng, s.restaurantLat, s.restaurantLng);
  if (distance > s.geofenceRadiusMeters) {
    return { ok: false, reason: "out_of_range", distance, radius: s.geofenceRadiusMeters };
  }
  return { ok: true, enforced: true, distance };
}
