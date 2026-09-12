import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { resolveScheduleFor, type StaffRota } from "@/lib/rota";
import { recompute, audit } from "@/lib/attendance-write";
import { classifyShiftStatus } from "@/lib/shift-status";

export const dynamic = "force-dynamic";

// GET /api/admin/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&staff_id=
export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const staffId = searchParams.get("staff_id");

  let q = supabase.from("attendance").select("*").order("work_date", { ascending: false }).order("clock_in");
  if (from) q = q.gte("work_date", from);
  if (to) q = q.lte("work_date", to);
  if (staffId) q = q.eq("staff_id", Number(staffId));

  let shiftsQ = supabase.from("shifts").select("staff_id, shift_date, start_time, end_time").neq("status", "cancelled");
  if (from) shiftsQ = shiftsQ.gte("shift_date", from);
  if (to) shiftsQ = shiftsQ.lte("shift_date", to);
  if (staffId) shiftsQ = shiftsQ.eq("staff_id", Number(staffId));

  const [{ data: rows, error }, { data: staff }, { data: shifts }, settings] = await Promise.all([
    q,
    supabase.from("staff").select("id, name").eq("active", 1).order("name"),
    shiftsQ,
    getAttendanceSettings(),
  ]);
  if (error) return NextResponse.json({ error: "Failed to load" }, { status: 500 });

  const nameById = new Map((staff ?? []).map((s) => [s.id, s.name]));
  const today = localDateString(new Date(), settings.timezone);
  const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

  // A shift with no matching attendance row at all — someone rota'd who
  // hasn't clocked in (today) or never showed (a past day). Never future
  // dates: nothing to check yet. Surfaced separately from `rows` since these
  // have no attendance id to edit — the UI offers "Clock in now" instead.
  const attendedKey = new Set((rows ?? []).map((r) => `${r.staff_id}-${r.work_date}`));
  const pending = (shifts ?? [])
    .filter((s) => s.shift_date <= today && !attendedKey.has(`${s.staff_id}-${s.shift_date}`))
    .map((s) => ({
      staff_id: s.staff_id,
      staff_name: nameById.get(s.staff_id) ?? "?",
      work_date: s.shift_date,
      shift_start: s.start_time.slice(0, 5),
      shift_end: s.end_time.slice(0, 5),
      status: classifyShiftStatus({
        workDate: s.shift_date, today, startHM: s.start_time.slice(0, 5), nowHM,
        hasOpenShift: false, hasClosedShift: false,
      }),
    }))
    .filter((p) => p.status !== "Upcoming"); // today, not due to start yet — nothing to flag

  return NextResponse.json({
    rows: (rows ?? []).map((r) => ({ ...r, staff_name: nameById.get(r.staff_id) ?? "?" })),
    staff: staff ?? [],
    pending,
  });
}

// POST — manual entry: a manager records a shift someone forgot to clock.
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const body = await req.json();
  const staffId = Number(body.staff_id);
  const workDate = String(body.work_date || "");
  const clockIn = body.clock_in ? new Date(body.clock_in).toISOString() : null;
  const clockOut = body.clock_out ? new Date(body.clock_out).toISOString() : null;
  if (!staffId || !workDate || !clockIn) {
    return NextResponse.json({ error: "Staff, date and clock-in are required" }, { status: 400 });
  }

  const settings = await getAttendanceSettings();
  const { data: staff } = await supabase
    .from("staff")
    .select("rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes")
    .eq("id", staffId)
    .maybeSingle();
  const rota = (staff ?? {}) as StaffRota;
  const sched = await resolveScheduleFor(staffId, workDate, rota, settings);

  const { patch } = recompute(
    {
      clockIn,
      clockOut,
      scheduledStart: sched.scheduledStart?.toISOString() ?? null,
      scheduledEnd: sched.scheduledEnd?.toISOString() ?? null,
      breakOverrideMinutes: body.break_override_minutes ?? null,
      adjustmentSeconds: Number(body.adjustment_seconds) || 0,
      scheduleBreakMinutes: sched.breakMinutes,
      graceSeconds: sched.graceMinutes * 60,
    },
    settings,
  );

  const { data: inserted, error } = await supabase
    .from("attendance")
    .insert({
      staff_id: staffId,
      work_date: workDate,
      shift_id: sched.shiftId,
      scheduled_start: sched.scheduledStart?.toISOString() ?? null,
      scheduled_end: sched.scheduledEnd?.toISOString() ?? null,
      clock_in: clockIn,
      clock_out: clockOut,
      clock_in_method: "manual",
      clock_out_method: clockOut ? "manual" : null,
      break_override_minutes: body.break_override_minutes ?? null,
      adjustment_seconds: Number(body.adjustment_seconds) || 0,
      status: clockOut ? "clocked_out" : "clocked_in",
      approval_status: "approved",
      approved_by: g.session.id,
      approved_at: new Date().toISOString(),
      entered_by: g.session.id,
      notes: body.notes || null,
      ...patch,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });

  await audit(g.session.id, "manual_entry", inserted.id, null, inserted);
  return NextResponse.json({ row: inserted }, { status: 201 });
}
