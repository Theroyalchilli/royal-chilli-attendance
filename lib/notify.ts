import supabase from "./supabase";
import { inQuietHours, managerIds, sendPush } from "./push";

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

// The phone notification's title per type. Shift alerts are time-critical and
// always buzz; everything else waits in the bell during quiet hours (1am–8am).
const TITLE: Record<NotifType, string> = {
  correction_submitted: "New correction request",
  correction_reviewed: "Correction update",
  missed_clockout: "Forgotten clock-out",
  leave_submitted: "New leave request",
  leave_reviewed: "Leave update",
  rota_ready: "Your rota is ready",
  shift_changed: "Your shift changed",
  shift_reminder: "Shift starting soon",
  not_clocked_in: "Not clocked in",
  clock_out_reminder: "Forgot to clock out?",
};
const ALWAYS_PUSH = new Set<NotifType>(["shift_reminder", "not_clocked_in", "clock_out_reminder"]);

function pushNow(type: NotifType): boolean {
  return ALWAYS_PUSH.has(type) || !inQuietHours();
}

/** In-app notification (the bell) + a phone notification. Best-effort — never blocks the caller. */
export async function notify(staffId: number, type: NotifType, message: string, link?: string): Promise<void> {
  try {
    await supabase.from("notifications").insert({ staff_id: staffId, type, message, link: link ?? null });
    if (pushNow(type)) await sendPush([staffId], { title: TITLE[type], body: message, url: link, tag: type });
  } catch (e) {
    console.error("notify failed:", e);
  }
}

/** Notify everyone who can act on manager things (manager / hr / admin). */
export async function notifyManagers(type: NotifType, message: string, link?: string): Promise<void> {
  try {
    const ids = await managerIds();
    if (!ids.length) return;
    await supabase.from("notifications").insert(ids.map((id) => ({ staff_id: id, type, message, link: link ?? null })));
    if (pushNow(type)) await sendPush(ids, { title: TITLE[type], body: message, url: link, tag: `${type}-${Date.now()}` });
  } catch (e) {
    console.error("notifyManagers failed:", e);
  }
}
