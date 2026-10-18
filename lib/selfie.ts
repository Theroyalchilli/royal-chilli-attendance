"use client";

// The clock-in photo itself is taken by components/me/SelfieCamera (live
// preview + on-device face check).

/**
 * Current position, or null on denial/timeout/no support. accuracy is the
 * phone's own "within this many metres".
 *
 * Indoors the first reading is often a rough Wi-Fi/phone-mast guess hundreds
 * of metres out (or a cached one from before they arrived), which made staff
 * standing in the restaurant show as far away. So listen for a few seconds
 * and keep the most accurate reading, stopping early once it's good.
 */
export function getPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  const GOOD_ENOUGH_M = 30;
  const MAX_WAIT_MS = 8_000;
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let best: { lat: number; lng: number; accuracy: number } | null = null;
    let id: number | null = null;
    const finish = () => {
      if (id != null) navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      resolve(best);
    };
    const timer = setTimeout(finish, MAX_WAIT_MS);
    id = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.accuracy) {
          best = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        }
        if (best.accuracy <= GOOD_ENOUGH_M) finish();
      },
      // Denied → give up now; any other error, keep waiting for a reading.
      (err) => { if (err.code === err.PERMISSION_DENIED) finish(); },
      { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 },
    );
  });
}
