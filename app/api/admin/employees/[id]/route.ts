import { NextRequest, NextResponse } from "next/server";
import { bizDb, staffWorksAt } from "@/lib/business-db";
import { requireManager } from "@/lib/guard";
import { getAttendanceSettings, localDateString, localIsoWeekday } from "@/lib/settings";

export const dynamic = "force-dynamic";

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** [from, to] (inclusive) for "day" | "week" (Mon–Sun) | "month" around `anchor`. */
function rangeFor(range: string, anchor: string): { from: string; to: string } {
  if (range === "week") {
    const weekday = new Date(anchor + "T12:00:00Z").getUTCDay(); // 0=Sun..6=Sat
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const from = addDays(anchor, mondayOffset);
    return { from, to: addDays(from, 6) };
  }
  if (range === "month") {
    const [y, m] = anchor.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from, to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
  }
  return { from: anchor, to: anchor }; // day
}

// GET ?range=day|week|month&date=YYYY-MM-DD — a single employee's attendance,
// corrections, this-week timesheet and full payroll history. Payroll is
// read-only here; every mutation stays in the POS.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);
  const staffId = Number((await params).id);
  if (!(await staffWorksAt(db, staffId))) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

  const settings = await getAttendanceSettings(g.session.businessId);
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "week";
  const anchor = searchParams.get("date") || localDateString(new Date(), settings.timezone);
  const { from, to } = rangeFor(range, anchor);

  const { data: staff, error: staffErr } = await db
    .from("staff")
    .select(
      "id, name, role, employee_number, employment_type, pay_rate, active, rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes",
    )
    .eq("id", staffId)
    .maybeSingle();
  if (staffErr || !staff) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  // split-shift second slot (POS migration 066) — skipped if not migrated yet
  const second = await db.from("staff").select("rota_start_2, rota_end_2").eq("id", staffId).maybeSingle();
  if (!second.error && second.data) Object.assign(staff, second.data);

  const [{ data: attendance }, { data: shifts }, { data: corrections }, { data: leave }] =
    await Promise.all([
      db.from("attendance").select("*").eq("staff_id", staffId).gte("work_date", from).lte("work_date", to).order("work_date"),
      db.from("shifts").select("shift_date").eq("staff_id", staffId).gte("shift_date", from).lte("shift_date", to).neq("status", "cancelled"),
      db.from("attendance_corrections").select("*").eq("staff_id", staffId).order("created_at", { ascending: false }).limit(20),
      db.from("leave_requests").select("start_date, end_date").eq("staff_id", staffId).eq("status", "approved").lte("start_date", to).gte("end_date", from),
    ]);

  // --- summary over the range ---
  const attByDate = new Map((attendance ?? []).map((r) => [r.work_date, r]));
  const shiftDates = new Set((shifts ?? []).map((s) => s.shift_date));
  const leaveRanges = leave ?? [];
  const onLeave = (d: string) => leaveRanges.some((l) => l.start_date <= d && d <= l.end_date);

  const workingDays = staff.rota_working_days ?? [1, 2, 3, 4, 5];
  let cursor = from;
  let scheduledDays = 0;
  let absences = 0;
  while (cursor <= to) {
    const isScheduled =
      shiftDates.has(cursor) ||
      (!!staff.rota_start && !!staff.rota_end && workingDays.includes(localIsoWeekday(new Date(cursor + "T12:00:00Z"), settings.timezone)));
    if (isScheduled) {
      scheduledDays++;
      if (!attByDate.get(cursor)?.clock_in && !onLeave(cursor)) absences++;
    }
    cursor = addDays(cursor, 1);
  }

  let hoursSeconds = 0;
  let daysWorked = 0;
  let lateCount = 0;
  for (const r of attendance ?? []) {
    if (r.clock_out) {
      hoursSeconds += r.net_work_seconds ?? 0;
      daysWorked++;
    }
    if ((r.late_seconds ?? 0) > 0) lateCount++;
  }

  // --- this week's timesheet (locking is always weekly) ---
  const weekday0 = new Date(anchor + "T12:00:00Z").getUTCDay();
  const weekFrom = addDays(anchor, weekday0 === 0 ? -6 : 1 - weekday0);
  const weekTo = addDays(weekFrom, 6);
  const { data: timesheet } = await db
    .from("timesheets")
    .select("*")
    .eq("staff_id", staffId)
    .eq("period_start", weekFrom)
    .eq("period_end", weekTo)
    .maybeSingle();

  return NextResponse.json({
    canEditLockedTimes: g.session.role === "admin",
    staff,
    range: { range, from, to },
    summary: {
      hours_seconds: hoursSeconds,
      days_worked: daysWorked,
      scheduled_days: scheduledDays,
      late_count: lateCount,
      absences,
    },
    attendance: attendance ?? [],
    corrections: corrections ?? [],
    timesheet: timesheet ?? null,
    week: { from: weekFrom, to: weekTo },
  });
}
