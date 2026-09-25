import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { classifyShiftStatus } from "@/lib/shift-status";

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

  // Food safety's queries run in the SAME parallel batch as everything
  // else below, not as a second sequential round-trip after it — that was
  // the actual cause of the dashboard measurably slowing down for
  // manager/admin after this card shipped (confirmed: HR, which skips this
  // block entirely, loaded ~300-450ms faster than admin on the exact same
  // request). Excluded for HR by simply not running these five queries at
  // all for them, same as before.
  const includeFoodSafety = g.session.role !== "hr";
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  const [
    { data: staff },
    { data: shiftsToday },
    { data: attToday },
    { data: openRows },
    { data: leaveNow },
    { data: pendingCorr },
    { data: weekAtt },
    { data: weekPresence },
    fsChecksTotal,
    fsCheckLogsToday,
    fsTempLogsToday,
    fsSignoffToday,
    fsCourses,
    fsTrainingRecords,
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
    includeFoodSafety ? supabase.from("fs_check_type").select("id", { count: "exact", head: true }).eq("active", true) : Promise.resolve({ count: 0 }),
    includeFoodSafety ? supabase.from("fs_check_log").select("check_type_id, ok").gte("created_at", dayStart).lte("created_at", dayEnd) : Promise.resolve({ data: [] }),
    includeFoodSafety ? supabase.from("fs_temp_log").select("pass").gte("created_at", dayStart).lte("created_at", dayEnd) : Promise.resolve({ data: [] }),
    includeFoodSafety ? supabase.from("fs_signoff").select("id").eq("day", today).maybeSingle() : Promise.resolve({ data: null }),
    includeFoodSafety ? supabase.from("fs_course").select("id, refresh_months").eq("active", true) : Promise.resolve({ data: [] }),
    includeFoodSafety ? supabase.from("fs_training_record").select("staff_id, course_id, date_done").order("date_done", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const activeCount = staff?.length ?? 0;
  const nameById = new Map((staff ?? []).map((s) => [s.id, s.name]));
  const roleById = new Map((staff ?? []).map((s) => [s.id, s.role]));

  // --- today's shifts w/ status ---
  // An open row older than the missing-clockout threshold is a forgotten
  // clock-out, not "currently working" — never let it read as "On Shift".
  const openSet = new Set((openRows ?? []).filter((r) => r.clock_in >= staleBefore).map((r) => r.staff_id));
  const staleOpenSet = new Set((openRows ?? []).filter((r) => r.clock_in < staleBefore).map((r) => r.staff_id));
  const clockedOutToday = new Set((attToday ?? []).filter((r) => r.clock_out).map((r) => r.staff_id));
  const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const todaysShifts = (shiftsToday ?? [])
    .map((s) => ({
      staff_name: nameById.get(s.staff_id) ?? "?",
      role: s.position || roleById.get(s.staff_id) || "",
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
      status: classifyShiftStatus({
        workDate: today, today, startHM: s.start_time.slice(0, 5), nowHM,
        hasOpenShift: openSet.has(s.staff_id), hasClosedShift: clockedOutToday.has(s.staff_id),
        hasStaleOpenShift: staleOpenSet.has(s.staff_id),
      }),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  // --- attendance breakdown (present on-time / late / on leave / absent) ---
  // "Absent" only ever counts staff who were actually rota'd today — it used
  // to be every active staff member minus whoever'd shown up, which meant
  // everyone read as "absent" first thing in the morning before any shift
  // had even started, or if they simply had no shift scheduled at all. The
  // tile's total is scheduled ∪ present ∪ on-leave, so someone who works an
  // unscheduled shift still shows up as Present rather than being hidden.
  const scheduled = new Set((shiftsToday ?? []).map((r) => r.staff_id));
  const onLeave = new Set((leaveNow ?? []).map((r) => r.staff_id));
  const present = new Set((attToday ?? []).filter((r) => r.clock_in).map((r) => r.staff_id));
  const late = new Set((attToday ?? []).filter((r) => r.clock_in && (r.late_seconds ?? 0) > 0).map((r) => r.staff_id));
  const lateCount = late.size;
  const presentOnTime = present.size - lateCount;
  const onLeaveCount = [...onLeave].filter((id) => !present.has(id)).length;
  const absentCount = [...scheduled].filter((id) => !present.has(id) && !onLeave.has(id)).length;
  const attendanceTotal = present.size + onLeaveCount + absentCount;

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

  // Food safety summary — excluded for HR entirely (HANDOVER.md §2: it's a
  // kitchen operation, not a people one), so the field is just omitted for
  // them rather than sent empty. Manager/admin both get it; the dashboard
  // card is read-only either way, matching admin's view-only access to the
  // module itself. Queries already ran above, in the same parallel batch.
  let foodSafety: {
    checks_done: number; checks_total: number; failures_today: number; signed_off: boolean; overdue_training: number;
  } | null = null;

  if (includeFoodSafety) {
    const checkLogsToday = (fsCheckLogsToday.data ?? []) as { check_type_id: number; ok: boolean }[];
    const tempLogsToday = (fsTempLogsToday.data ?? []) as { pass: boolean }[];
    const courses = (fsCourses.data ?? []) as { id: number; refresh_months: number }[];
    const trainingRecords = (fsTrainingRecords.data ?? []) as { staff_id: number; course_id: number; date_done: string }[];

    const doneTypes = new Set(checkLogsToday.map((c) => c.check_type_id));
    const failuresToday = checkLogsToday.filter((c) => !c.ok).length + tempLogsToday.filter((t) => !t.pass).length;

    const staffIdsInScope = new Set((staff ?? []).filter((s) => s.role !== "hr").map((s) => s.id));
    const latest = new Map<string, string>(); // "staffId:courseId" -> date_done
    for (const r of trainingRecords) {
      const key = `${r.staff_id}:${r.course_id}`;
      if (!latest.has(key)) latest.set(key, r.date_done);
    }
    let overdueTraining = 0;
    for (const staffId of staffIdsInScope) {
      for (const c of courses) {
        if (!c.refresh_months) continue;
        const dateDone = latest.get(`${staffId}:${c.id}`);
        if (!dateDone) continue; // not_done isn't counted as "overdue" here — it's a different signal
        const due = new Date(dateDone);
        due.setMonth(due.getMonth() + c.refresh_months);
        if (due.getTime() < Date.now()) overdueTraining++;
      }
    }

    foodSafety = {
      checks_done: doneTypes.size,
      checks_total: fsChecksTotal.count ?? 0,
      failures_today: failuresToday,
      signed_off: !!fsSignoffToday.data,
      overdue_training: overdueTraining,
    };
  }

  return NextResponse.json({
    today,
    timezone: tz,
    employees: activeCount,
    foodSafety,
    todaysShifts,
    attendance: {
      total: attendanceTotal,
      present: presentOnTime,
      late: lateCount,
      absent: absentCount,
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
