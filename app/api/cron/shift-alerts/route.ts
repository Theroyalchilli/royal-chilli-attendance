import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { assertCron } from "@/lib/cron";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { dueShiftAlerts, type AlertKind } from "@/lib/shift-alerts";
import { notify, notifyManagers } from "@/lib/notify";
import { deliverDueMessages } from "@/lib/staff-messages";

export const dynamic = "force-dynamic";

// Every 5 minutes, from cron-job.org (Vercel's free plan only runs daily jobs).
// Needs the header  Authorization: Bearer <CRON_SECRET>.
// Sends the shift reminders in lib/shift-alerts.ts, each once per shift, and
// any scheduled staff messages that are due (lib/staff-messages.ts).
export async function GET(req: NextRequest) {
  const bad = assertCron(req);
  if (bad) return bad;

  const settings = await getAttendanceSettings();
  const now = new Date();
  const today = localDateString(now, settings.timezone);
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10); // overnight shifts still running

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, staff_id, shift_date, start_time, end_time, business_id")
    .in("shift_date", [yesterday, today])
    .neq("status", "cancelled");
  // scheduled staff messages due by now
  const messages = await deliverDueMessages(now);
  if (!shifts?.length) return NextResponse.json({ checked: 0, sent: 0, messages });

  const staffIds = [...new Set(shifts.map((s) => s.staff_id))];
  const shiftIds = shifts.map((s) => s.id);
  const [{ data: attendance }, { data: sentRows }, { data: leave }, { data: staff }] = await Promise.all([
    supabase.from("attendance").select("staff_id, shift_id, clock_in, clock_out").in("staff_id", staffIds).in("work_date", [yesterday, today]),
    supabase.from("shift_alerts_sent").select("shift_id, kind").in("shift_id", shiftIds),
    supabase.from("leave_requests").select("staff_id, start_date, end_date").eq("status", "approved").lte("start_date", today).gte("end_date", yesterday),
    supabase.from("staff").select("id, name, active").in("id", staffIds),
  ]);
  const activeName = new Map((staff ?? []).filter((s) => s.active).map((s) => [s.id, s.name as string]));

  const due = dueShiftAlerts({
    now,
    tz: settings.timezone,
    shifts: shifts.filter((s) => activeName.has(s.staff_id)),
    attendance: attendance ?? [],
    alreadySent: new Set((sentRows ?? []).map((r) => `${r.shift_id}:${r.kind}`)),
    onLeave: (id, date) => (leave ?? []).some((l) => l.staff_id === id && date >= l.start_date && date <= l.end_date),
  });

  const hm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  let sent = 0;
  for (const a of due) {
    // claim first so an overlapping run can't send it twice
    const { error } = await supabase.from("shift_alerts_sent").insert({ shift_id: a.shift.id, kind: a.kind as AlertKind });
    if (error) continue;
    const who = a.shift.staff_id;
    const name = (activeName.get(who) ?? "Someone").split(" ")[0];
    if (a.kind === "before_start") {
      await notify(who, "shift_reminder", `Your shift starts at ${hm(a.start)} — don't forget to clock in.`, "/me");
    } else if (a.kind === "not_clocked_in") {
      await notify(who, "not_clocked_in", `You haven't clocked in for your ${hm(a.start)} shift.`, "/me");
      await notifyManagers(a.shift.business_id ?? 1, "not_clocked_in", `${name} hasn't clocked in — ${hm(a.start)} shift.`, `/admin/attendance?staff_id=${who}&date=${a.shift.shift_date}`);
    } else {
      await notify(who, "clock_out_reminder", `Did you forget to clock out? Your shift ended at ${hm(a.end)}.`, "/me");
    }
    sent++;
  }
  return NextResponse.json({ checked: shifts.length, sent, messages });
}
