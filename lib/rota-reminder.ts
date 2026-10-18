import supabase from "./supabase";
import { notify, notifyManagers } from "./notify";
import { staffIdsAt } from "./business";
import { NOT_ON_ROTA } from "./roles";
import { addDays, ukMonday } from "./uk-date";

// "Next week's rota isn't done" — Vercel crons (vercel.json): Friday to the
// managers, then Sunday evening to the managers and the group owner if it's
// still empty. "Not done" = no shifts at all next week for a business that
// has people on the rota (part-timers can have an empty week, so one person
// with no shifts doesn't count).

export type RotaReminderStage = "first" | "final";

/** Monday–Sunday of next week, as UK dates. */
export function nextWeek(now: Date = new Date()): { from: string; to: string } {
  const from = addDays(ukMonday(now), 7);
  return { from, to: addDays(from, 6) };
}

export function rotaReminderText(stage: RotaReminderStage, businessName: string, from: string): string {
  const day = new Date(`${from}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return stage === "first"
    ? `Next week's rota (from ${day}) isn't done yet. Tap to open the Rota — Copy last week or Fill from defaults.`
    : `${businessName}: next week's rota (from ${day}) is still empty, and it starts tomorrow. Staff don't know their shifts.`;
}

/** Sends the reminders; returns the businesses that were reminded. */
export async function sendRotaReminders(stage: RotaReminderStage, now: Date = new Date()): Promise<string[]> {
  const { from, to } = nextWeek(now);
  const link = `/admin/rota?week=${from}`;
  const { data: businesses } = await supabase.from("businesses").select("id, name").eq("active", true);
  const owners = stage === "final"
    ? ((await supabase.from("staff").select("id").eq("active", 1).eq("is_owner", true)).data ?? []).map((s) => s.id as number)
    : [];
  const reminded: string[] = [];

  for (const b of businesses ?? []) {
    const here = await staffIdsAt(b.id);
    if (!here.length) continue;
    const [{ count: onRota }, { count: shifts }] = await Promise.all([
      supabase.from("staff").select("id", { count: "exact", head: true })
        .eq("active", 1).eq("on_rota", true).in("id", here).not("role", "in", `(${NOT_ON_ROTA.join(",")})`),
      supabase.from("shifts").select("id", { count: "exact", head: true })
        .eq("business_id", b.id).gte("shift_date", from).lte("shift_date", to).neq("status", "cancelled"),
    ]);
    if (!onRota || (shifts ?? 0) > 0) continue;

    const text = rotaReminderText(stage, b.name, from);
    await notifyManagers(b.id, "rota_missing", text, link);
    for (const id of owners) await notify(id, "rota_missing", text, link);
    reminded.push(b.name);
  }
  return reminded;
}
