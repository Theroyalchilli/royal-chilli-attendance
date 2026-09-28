import supabase from "./supabase";

// Which alerts buzz each person's phone (My account → Notifications).
// Manager messages and shift reminders have no switch — always on.
// Everything always lands in the 🔔 bell either way.

export type Prefs = { rota: boolean; requests: boolean; team_late: boolean; team_requests: boolean };
export type PrefKey = keyof Prefs;
export const DEFAULT_PREFS: Prefs = { rota: true, requests: true, team_late: true, team_requests: true };

/** The switch that controls a type — for the person's own alerts, or a copy sent to managers. Null = always on. */
export function prefFor(type: string, audience: "self" | "managers"): PrefKey | null {
  if (audience === "managers") {
    if (type === "not_clocked_in" || type === "missed_clockout") return "team_late";
    if (type === "leave_submitted" || type === "correction_submitted") return "team_requests";
    return null;
  }
  if (type === "rota_ready" || type === "shift_changed") return "rota";
  if (type === "leave_reviewed" || type === "correction_reviewed") return "requests";
  return null;
}

export async function getPrefs(staffIds: number[]): Promise<Map<number, Prefs>> {
  const out = new Map<number, Prefs>(staffIds.map((id) => [id, { ...DEFAULT_PREFS }]));
  if (!staffIds.length) return out;
  const { data } = await supabase.from("notification_prefs").select("staff_id, rota, requests, team_late, team_requests").in("staff_id", staffIds);
  for (const r of data ?? []) out.set(r.staff_id, { rota: r.rota, requests: r.requests, team_late: r.team_late, team_requests: r.team_requests });
  return out;
}

/** Link that opens the right screen AND marks this notification read (?nid=). */
export function withNid(link: string | null | undefined, nid: number): string {
  const base = link && !link.startsWith("http") ? link : "/me";
  return `${base}${base.includes("?") ? "&" : "?"}nid=${nid}`;
}
