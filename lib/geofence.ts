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
  | {
      ok: false;
      reason: "no_location" | "out_of_range" | "rough_location" | "not_configured";
      distance?: number;
      radius?: number;
      accuracy?: number;
    };

/** Most a reading's own error margin can stretch the radius. */
export const MAX_ACCURACY_SLACK_M = 100;
/** A reading less accurate than this can't tell inside from up the road. */
export const ROUGH_ACCURACY_M = 250;

/**
 * Is a reading inside the geofence? accuracy is the phone's "within this many
 * metres". Indoors a reading drifts, so its margin (capped) counts in the
 * person's favour; a reading too rough to tell gets "rough_location" rather
 * than claiming they're far away.
 */
export function judgeLocation(distance: number, radius: number, accuracy: number | null): GeoCheck {
  const slack = Math.min(Math.max(accuracy ?? 0, 0), MAX_ACCURACY_SLACK_M);
  if (distance - slack <= radius) return { ok: true, enforced: true, distance };
  if (accuracy != null && accuracy > ROUGH_ACCURACY_M) {
    return { ok: false, reason: "rough_location", distance, radius, accuracy: Math.round(accuracy) };
  }
  return { ok: false, reason: "out_of_range", distance, radius };
}

/** 85 → "85m", 2400 → "2.4 km". */
export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * Check a clock punch's location against the restaurant geofence.
 * Disabled → always ok (not enforced). Enabled but no coords set → ok but a
 * warning ("not_configured" is only returned when enabled and missing coords
 * AND a location was supplied — we don't want to hard-block on misconfig).
 */
export async function checkGeofence(
  businessId: number,
  lat: number | null,
  lng: number | null,
  accuracy: number | null = null,
): Promise<GeoCheck> {
  const s = await getAttendanceSettings(businessId);
  if (!s.geofenceEnabled) return { ok: true, enforced: false };
  if (s.restaurantLat == null || s.restaurantLng == null) return { ok: true, enforced: false };

  if (lat == null || lng == null) return { ok: false, reason: "no_location" };

  return judgeLocation(distanceMeters(lat, lng, s.restaurantLat, s.restaurantLng), s.geofenceRadiusMeters, accuracy);
}
