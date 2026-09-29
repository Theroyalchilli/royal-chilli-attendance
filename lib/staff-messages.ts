import supabase from "./supabase";
import { bizDb } from "./business-db";
import { staffIdsAt } from "./business";
import { sendPush } from "./push";
import { withNid } from "./notification-prefs";
import { getAttendanceSettings, localDateString } from "./settings";

// Messages a manager/admin writes to staff: into the 🔔 bell and to phones
// with notifications on. Sent now, or at a set time by the 5-minute check.
// Quiet hours don't apply — someone chose to send it.

export type Audience = "everyone" | "today" | "managers" | "people";
export const AUDIENCE_LABEL: Record<Audience, string> = {
  everyone: "Everyone",
  today: "Working today",
  managers: "Managers only",
  people: "Chosen people",
};

/** Who a message goes to right now (active staff only). */
export async function recipientsFor(businessId: number, audience: Audience, staffIds: number[] = []): Promise<number[]> {
  const { data: active } = await supabase.from("staff").select("id, role").eq("active", 1).in("id", await staffIdsAt(businessId));
  const all = (active ?? []) as { id: number; role: string }[];
  if (audience === "everyone") return all.map((s) => s.id);
  if (audience === "managers") return all.filter((s) => ["manager", "hr", "admin"].includes(s.role)).map((s) => s.id);
  if (audience === "people") {
    const ok = new Set(all.map((s) => s.id));
    return [...new Set(staffIds)].filter((id) => ok.has(id));
  }
  // working today: on today's rota, or clocked in right now
  const settings = await getAttendanceSettings();
  const today = localDateString(new Date(), settings.timezone);
  const [{ data: shifts }, { data: open }] = await Promise.all([
    bizDb(businessId).from("shifts").select("staff_id").eq("shift_date", today).neq("status", "cancelled"),
    bizDb(businessId).from("attendance").select("staff_id").is("clock_out", null).not("clock_in", "is", null),
  ]);
  const ok = new Set(all.map((s) => s.id));
  return [...new Set([...(shifts ?? []), ...(open ?? [])].map((r) => r.staff_id))].filter((id) => ok.has(id));
}

/** How many of these people have phone notifications on. */
export async function phonesOn(staffIds: number[]): Promise<number> {
  if (!staffIds.length) return 0;
  const { data } = await supabase.from("push_subscriptions").select("staff_id").in("staff_id", staffIds);
  return new Set((data ?? []).map((r) => r.staff_id)).size;
}

type MessageRow = { id: number; business_id: number; title: string; body: string; audience: Audience; staff_ids: number[] | null };

/** Deliver one message (claimed first, so it can never go twice). */
export async function deliverMessage(id: number): Promise<{ recipients: number; phones: number } | null> {
  const { data: claimed } = await supabase
    .from("staff_messages")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
    .is("sent_at", null)
    .is("cancelled_at", null)
    .select("id, business_id, title, body, audience, staff_ids")
    .maybeSingle();
  if (!claimed) return null;
  const m = claimed as MessageRow;
  const ids = await recipientsFor(m.business_id, m.audience, m.staff_ids ?? []);
  // bell rows first; each phone alert links with its own id (?nid=) so
  // tapping it opens the message and marks it read
  const { data: rows } = ids.length
    ? await supabase
        .from("notifications")
        .insert(ids.map((sid) => ({ staff_id: sid, type: "staff_message", title: m.title, message: m.body, message_id: m.id, link: null })))
        .select("id, staff_id")
    : { data: [] as { id: number; staff_id: number }[] };
  const sends = await Promise.all(
    (rows ?? []).map((r) => sendPush([r.staff_id], { title: m.title, body: m.body, url: withNid("/me", r.id), tag: `message-${m.id}` })),
  );
  const phones = sends.reduce((a, b) => a + b, 0);
  await supabase.from("staff_messages").update({ recipients: ids.length, phones }).eq("id", m.id);
  return { recipients: ids.length, phones };
}

/** Called by the 5-minute check: send anything scheduled for now or earlier. */
export async function deliverDueMessages(now: Date = new Date()): Promise<number> {
  const { data } = await supabase
    .from("staff_messages")
    .select("id")
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lte("send_at", now.toISOString())
    .order("send_at");
  let sent = 0;
  for (const m of data ?? []) if (await deliverMessage(m.id)) sent++;
  return sent;
}
