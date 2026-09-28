import supabase from "./supabase";
import { inQuietHours, managerIds, sendPush } from "./push";
import { kindOf } from "./notification-kinds";
import { getPrefs, prefFor, withNid } from "./notification-prefs";

export type NotifType =
  | "correction_submitted"
  | "correction_reviewed"
  | "missed_clockout"
  | "leave_submitted"
  | "leave_reviewed"
  | "rota_ready"
  | "shift_changed"
  | "shift_reminder"
  | "not_clocked_in"
  | "clock_out_reminder";

// Titles per type live in lib/notification-kinds.ts (shared with the bell).
// Shift alerts are time-critical and always buzz; everything else waits in
// the bell during quiet hours (1am–8am). Each person's switches
// (lib/notification-prefs.ts) decide which alerts buzz their phone.
const TITLE = (type: NotifType) => kindOf(type).title;
const ALWAYS_PUSH = new Set<NotifType>(["shift_reminder", "not_clocked_in", "clock_out_reminder"]);

function pushNow(type: NotifType): boolean {
  return ALWAYS_PUSH.has(type) || !inQuietHours();
}

/** Bell + phone for each row, if their switches allow. Each phone alert links with its own id so tapping it marks it read. */
async function pushRows(rows: { id: number; staff_id: number }[], type: NotifType, message: string, link: string | undefined, audience: "self" | "managers") {
  if (!rows.length || !pushNow(type)) return;
  const key = prefFor(type, audience);
  const prefs = key ? await getPrefs(rows.map((r) => r.staff_id)) : null;
  await Promise.all(
    rows
      .filter((r) => !key || prefs!.get(r.staff_id)?.[key] !== false)
      .map((r) => sendPush([r.staff_id], { title: TITLE(type), body: message, url: withNid(link, r.id), tag: `${type}-${r.id}` })),
  );
}

/** In-app notification (the bell) + a phone notification. Best-effort — never blocks the caller. */
export async function notify(staffId: number, type: NotifType, message: string, link?: string): Promise<void> {
  try {
    const { data } = await supabase
      .from("notifications")
      .insert({ staff_id: staffId, type, title: TITLE(type), message, link: link ?? null })
      .select("id, staff_id")
      .single();
    if (data) await pushRows([data], type, message, link, "self");
  } catch (e) {
    console.error("notify failed:", e);
  }
}

/** Notify everyone who can act on manager things (manager / hr / admin). */
export async function notifyManagers(type: NotifType, message: string, link?: string): Promise<void> {
  try {
    const ids = await managerIds();
    if (!ids.length) return;
    const { data } = await supabase
      .from("notifications")
      .insert(ids.map((id) => ({ staff_id: id, type, title: TITLE(type), message, link: link ?? null })))
      .select("id, staff_id");
    await pushRows(data ?? [], type, message, link, "managers");
  } catch (e) {
    console.error("notifyManagers failed:", e);
  }
}
