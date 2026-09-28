import { notify } from "./notify";

// Rota change alerts to the staff member (bell + phone). Only for today or
// later — the rota routes already refuse past dates.

const hm = (t: string) => t.slice(0, 5);
const day = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export async function alertShiftAdded(staffId: number, date: string, start: string, end: string) {
  await notify(staffId, "shift_changed", `New shift: ${day(date)}, ${hm(start)}–${hm(end)}.`, "/me/rota");
}

export async function alertShiftChanged(staffId: number, date: string, oldStart: string, oldEnd: string, start: string, end: string) {
  if (hm(oldStart) === hm(start) && hm(oldEnd) === hm(end)) return;
  await notify(staffId, "shift_changed", `Your shift on ${day(date)} changed to ${hm(start)}–${hm(end)} (was ${hm(oldStart)}–${hm(oldEnd)}).`, "/me/rota");
}

export async function alertShiftRemoved(staffId: number, date: string, start: string, end: string) {
  await notify(staffId, "shift_changed", `Your shift on ${day(date)}, ${hm(start)}–${hm(end)}, was removed.`, "/me/rota");
}

/** "Fill from defaults" / "Copy last week": one alert per person, not one per shift. */
export async function alertRotaReady(shifts: { staff_id: number; shift_date: string }[]) {
  const byStaff = new Map<number, string[]>();
  for (const s of shifts) byStaff.set(s.staff_id, [...(byStaff.get(s.staff_id) ?? []), s.shift_date]);
  await Promise.all(
    [...byStaff].map(([staffId, dates]) => {
      const sorted = [...dates].sort();
      const range = sorted[0] === sorted[sorted.length - 1] ? day(sorted[0]) : `${day(sorted[0])} – ${day(sorted[sorted.length - 1])}`;
      return notify(staffId, "rota_ready", `Your rota for ${range} is ready: ${dates.length} shift${dates.length === 1 ? "" : "s"}. Tap to view.`, "/me/rota");
    }),
  );
}
