// How each kind of notification looks in the panel: icon, filter group, icon
// tint, and the title used when a row has none of its own (older rows).
// Shared by the server (lib/notify.ts) and the bell — safe in the browser.

export type NotifGroup = "message" | "shift" | "request";
export type Kind = { icon: string; group: NotifGroup; title: string; tint: string };

export const KINDS: Record<string, Kind> = {
  staff_message: { icon: "📣", group: "message", title: "Message from the manager", tint: "bg-red-50" },
  shift_reminder: { icon: "⏰", group: "shift", title: "Shift starting soon", tint: "bg-amber-50" },
  not_clocked_in: { icon: "🚨", group: "shift", title: "Not clocked in", tint: "bg-red-100" },
  clock_out_reminder: { icon: "🕐", group: "shift", title: "Forgot to clock out?", tint: "bg-orange-50" },
  missed_clockout: { icon: "🕐", group: "shift", title: "Forgotten clock-out", tint: "bg-orange-50" },
  rota_ready: { icon: "📅", group: "shift", title: "Your rota is ready", tint: "bg-blue-50" },
  shift_changed: { icon: "✏️", group: "shift", title: "Your shift changed", tint: "bg-violet-50" },
  leave_submitted: { icon: "🌴", group: "request", title: "New leave request", tint: "bg-emerald-50" },
  leave_reviewed: { icon: "🌴", group: "request", title: "Leave update", tint: "bg-emerald-50" },
  correction_submitted: { icon: "📝", group: "request", title: "New correction request", tint: "bg-sky-50" },
  correction_reviewed: { icon: "📝", group: "request", title: "Correction update", tint: "bg-sky-50" },
};
const FALLBACK: Kind = { icon: "🔔", group: "request", title: "Notification", tint: "bg-neutral-100" };

export const kindOf = (type: string): Kind => KINDS[type] ?? FALLBACK;

/** Title + text for a row. Older staff messages were stored as "Title — body". */
export function splitNotification(n: { type: string; title?: string | null; message: string }): { title: string; body: string } {
  if (n.title) return { title: n.title, body: n.message };
  if (n.type === "staff_message" && n.message.includes(" — ")) {
    const i = n.message.indexOf(" — ");
    return { title: n.message.slice(0, i), body: n.message.slice(i + 3) };
  }
  return { title: kindOf(n.type).title, body: n.message };
}
