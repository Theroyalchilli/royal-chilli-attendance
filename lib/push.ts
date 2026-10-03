import webpush from "web-push";
import supabase from "./supabase";
import { staffIdsAt } from "./business";

// Phone notifications (web push) for staff who tapped "Turn on notifications"
// — Android, and iPhone (iOS 16.4+) when the app is on the Home Screen.
// Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY on the Vercel project; without
// them this quietly does nothing, so the in-app bell still works.

const PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:Info@theroyalchilli.com";
let configured = false;

export function pushConfigured(): boolean {
  if (!PUBLIC || !PRIVATE) return false;
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  }
  return true;
}

export const vapidPublicKey = () => PUBLIC;

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Quiet hours 1am–8am UK: routine alerts wait in the bell. Shift alerts ignore this. */
export function inQuietHours(now: Date = new Date()): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now)) % 24;
  return h >= 1 && h < 8;
}

/** Send to every phone these staff turned notifications on for. Best-effort; never throws. */
export async function sendPush(staffIds: number[], msg: PushMessage): Promise<number> {
  if (!staffIds.length || !pushConfigured()) return 0;
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("staff_id", [...new Set(staffIds)]);
    let sent = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? "/", tag: msg.tag }),
            { TTL: 60 * 60, urgency: "high" },
          );
          sent++;
          await supabase.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          // the phone unsubscribed / reinstalled — forget it
          if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
          else console.error("push send failed:", code, (err as Error).message);
        }
      }),
    );
    return sent;
  } catch (err) {
    console.error("sendPush failed:", err);
    return 0;
  }
}

/** Everyone at this business who can act on manager things (manager / hr / admin). */
export async function managerIds(businessId: number): Promise<number[]> {
  const { data } = await supabase.from("staff").select("id").eq("active", 1).in("role", ["manager", "hr", "admin"])
    .in("id", await staffIdsAt(businessId));
  return (data ?? []).map((s) => s.id);
}
