import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { getAttendanceSettings, localDateString } from "@/lib/settings";

export const dynamic = "force-dynamic";

function daysBack(n: number, tz: string): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(localDateString(new Date(Date.now() - i * 86400_000), tz));
  }
  return out;
}

export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const settings = await getAttendanceSettings();
  const tz = settings.timezone;
  const today = localDateString(new Date(), tz);
  const staleBefore = new Date(Date.now() - settings.missingClockoutHours * 3600_000).toISOString();
  const week = daysBack(7, tz);
  const weekStart = week[0];

  const [
    { data: staff },
    { data: shiftsToday },
    { data: attToday },
    { data: openRows },
    { data: leaveNow },
    { data: pendingCorr },
    { data: weekAtt },
    { data: weekPresence },
  ] = await Promise.all([
    supabase.from("staff").select("id, name, role").eq("active", 1),
    supabase.from("shifts").select("staff_id, start_time, end_time, position").eq("shift_date", today).neq("status", "cancelled"),
    supabase.from("attendance").select("staff_id, clock_in, clock_out, late_seconds").eq("work_date", today),
    supabase.from("attendance").select("id, staff_id, clock_in").is("clock_out", null).not("clock_in", "is", null),
    supabase.from("leave_requests").select("staff_id").eq("status", "approved").lte("start_date", today).gte("end_date", today),
    supabase
      .from("attendance_corrections")
      .select("id, staff_id, original_snapshot, requested_change, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("attendance")
      .select("staff_id, net_work_seconds, overtime_seconds, clock_out")
      .gte("work_date", weekStart)
      .lte("work_date", today),
    supabase.from("attendance").select("staff_id, work_date, clock_in").gte("work_date", weekStart).lte("work_date", today).not("clock_in", "is", null),
  ]);

  const activeCount = staff?.length ?? 0;
  const nameById = new Map((staff ?? []).map((s) => [s.id, s.name]));
  const roleById = new Map((staff ?? []).map((s) => [s.id, s.role]));

  // --- today's shifts w/ status ---
  const openSet = new Set((openRows ?? []).map((r) => r.staff_id));
  const clockedOutToday = new Set((attToday ?? []).filter((r) => r.clock_out).map((r) => r.staff_id));
  const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const todaysShifts = (shiftsToday ?? [])
    .map((s) => ({
      staff_name: nameById.get(s.staff_id) ?? "?",
      role: s.position || roleById.get(s.staff_id) || "",
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
      status: openSet.has(s.staff_id)
        ? "On Shift"
        : clockedOutToday.has(s.staff_id)
          ? "Done"
          : s.start_time.slice(0, 5) > nowHM
            ? "Upcoming"
            : "Not in",
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  // --- attendance breakdown (present on-time / late / on leave / absent) ---
  const onLeave = new Set((leaveNow ?? []).map((r) => r.staff_id));
  const present = new Set((attToday ?? []).filter((r) => r.clock_in).map((r) => r.staff_id));
  const late = new Set((attToday ?? []).filter((r) => r.clock_in && (r.late_seconds ?? 0) > 0).map((r) => r.staff_id));
  const lateCount = late.size;
  const presentOnTime = present.size - lateCount;
  const onLeaveCount = [...onLeave].filter((id) => !present.has(id)).length;
  const absent = activeCount - presentOnTime - lateCount - onLeaveCount;

  // --- this week's timesheet preview ---
  const weekByStaff = new Map<number, { net: number; ot: number }>();
  for (const r of weekAtt ?? []) {
    if (!r.clock_out) continue;
    const cur = weekByStaff.get(r.staff_id) ?? { net: 0, ot: 0 };
    cur.net += r.net_work_seconds ?? 0;
    cur.ot += r.overtime_seconds ?? 0;
    weekByStaff.set(r.staff_id, cur);
  }
  const timesheetPreview = [...weekByStaff.entries()]
    .map(([id, v]) => ({ staff_name: nameById.get(id) ?? "?", net_seconds: v.net, overtime_seconds: v.ot }))
    .sort((a, b) => b.net_seconds - a.net_seconds)
    .slice(0, 5);
  const weekTotalSeconds = [...weekByStaff.values()].reduce((s, v) => s + v.net, 0);

  // --- 7-day attendance rate ---
  const presenceByDay = new Map<string, Set<number>>();
  for (const d of week) presenceByDay.set(d, new Set());
  for (const r of weekPresence ?? []) presenceByDay.get(r.work_date)?.add(r.staff_id);
  const attendanceRate = week.map((d) => ({
    date: d,
    label: new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    rate: activeCount ? Math.round(((presenceByDay.get(d)?.size ?? 0) / activeCount) * 100) : 0,
  }));

  // --- corrections preview ---
  const corrections = (pendingCorr ?? []).map((c) => {
    const snap = c.original_snapshot as { work_date?: string } | null;
    const chg = c.requested_change as Record<string, string>;
    const issue = chg.clock_in && chg.clock_out ? "Wrong times" : chg.clock_out ? "Clock-out fix" : chg.clock_in ? "Clock-in fix" : "Adjustment";
    return { id: c.id, staff_name: nameById.get(c.staff_id) ?? "?", date: snap?.work_date ?? "", issue, status: c.status, created_at: c.created_at };
  });

  return NextResponse.json({
    today,
    timezone: tz,
    employees: activeCount,
    todaysShifts,
    attendance: {
      total: activeCount,
      present: presentOnTime,
      late: lateCount,
      absent: Math.max(0, absent),
      onLeave: onLeaveCount,
    },
    corrections,
    timesheetPreview,
    weekTotalSeconds,
    attendanceRate,
    stuck: (openRows ?? [])
      .filter((r) => r.clock_in && r.clock_in < staleBefore)
      .map((r) => ({ id: r.id, staff_name: nameById.get(r.staff_id) ?? "?", clock_in: r.clock_in })),
  });
}
