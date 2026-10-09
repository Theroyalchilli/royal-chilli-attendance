import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { staffIdsAt } from "@/lib/business";
import { requireManager } from "@/lib/guard";
import { signedPhotoUrls } from "@/lib/photo";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { loadStaffRota, resolveScheduleFor } from "@/lib/rota";
import { recompute, audit } from "@/lib/attendance-write";
import { classifyShiftStatus } from "@/lib/shift-status";

export const dynamic = "force-dynamic";

// GET /api/admin/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&staff_id=
export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const staffId = searchParams.get("staff_id");

  let q = db.from("attendance").select("*").order("work_date", { ascending: false }).order("clock_in");
  if (from) q = q.gte("work_date", from);
  if (to) q = q.lte("work_date", to);
  if (staffId) q = q.eq("staff_id", Number(staffId));

  let shiftsQ = db.from("shifts").select("id, staff_id, shift_date, start_time, end_time").neq("status", "cancelled");
  if (from) shiftsQ = shiftsQ.gte("shift_date", from);
  if (to) shiftsQ = shiftsQ.lte("shift_date", to);
  if (staffId) shiftsQ = shiftsQ.eq("staff_id", Number(staffId));

  const [{ data: rows, error }, { data: staff }, { data: shifts }, settings, { data: openRows }] = await Promise.all([
    q,
    db.from("staff").select("id, name").eq("active", 1).in("id", await staffIdsAt(g.session.businessId)).order("name"),
    shiftsQ,
    getAttendanceSettings(g.session.businessId),
    // Every currently-open shift, any date — used to catch a forgotten
    // clock-out from a day outside whatever range is being viewed right now.
    db.from("attendance").select("staff_id, clock_in").is("clock_out", null).not("clock_in", "is", null),
  ]);
  if (error) return NextResponse.json({ error: "Failed to load" }, { status: 500 });

  const nameById = new Map((staff ?? []).map((s) => [s.id, s.name]));
  const today = localDateString(new Date(), settings.timezone);
  const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const staleBefore = new Date(Date.now() - settings.missingClockoutHours * 3600_000).toISOString();
  const staleOpenSet = new Set((openRows ?? []).filter((r) => r.clock_in < staleBefore).map((r) => r.staff_id));

  // A shift with no matching attendance row at all — someone rota'd who
  // hasn't clocked in (today) or never showed (a past day). Never future
  // dates: nothing to check yet. Surfaced separately from `rows` since these
  // have no attendance id to edit — the UI offers "Clock in now" instead.
  // Staff with a stale open shift from another day show "Stuck" here even
  // though today's own shift has nothing recorded — that's the real story.
  // Split shifts: a shift counts as attended by a row linked to it
  // (shift_id). A person/day with a single shift also accepts an unlinked
  // row (manual entries, rows from before shifts were linked).
  const attendedKey = new Set((rows ?? []).map((r) => `${r.staff_id}-${r.work_date}`));
  const attendedShift = new Set((rows ?? []).filter((r) => r.shift_id != null).map((r) => r.shift_id));
  const shiftsPerDay = new Map<string, number>();
  for (const s of shifts ?? []) {
    const k = `${s.staff_id}-${s.shift_date}`;
    shiftsPerDay.set(k, (shiftsPerDay.get(k) ?? 0) + 1);
  }
  const attended = (s: { id: number; staff_id: number; shift_date: string }) => {
    const k = `${s.staff_id}-${s.shift_date}`;
    return attendedShift.has(s.id) || (shiftsPerDay.get(k) === 1 && attendedKey.has(k));
  };
  const pending = (shifts ?? [])
    .filter((s) => s.shift_date <= today && !attended(s))
    .map((s) => ({
      staff_id: s.staff_id,
      staff_name: nameById.get(s.staff_id) ?? "?",
      work_date: s.shift_date,
      shift_start: s.start_time.slice(0, 5),
      shift_end: s.end_time.slice(0, 5),
      status: classifyShiftStatus({
        workDate: s.shift_date, today, startHM: s.start_time.slice(0, 5), nowHM,
        hasOpenShift: false, hasClosedShift: false, hasStaleOpenShift: staleOpenSet.has(s.staff_id),
      }),
    }))
    .filter((p) => p.status !== "Upcoming"); // today, not due to start yet — nothing to flag

  // The shift(s) currently on the rota for each person/day — shown in the
  // Rota column. Live rota, not the schedule snapshotted at clock-in, so it
  // matches the Rota page after edits. Split shifts are joined.
  const rotaByShiftId = new Map((shifts ?? []).map((s) => [s.id, `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`]));
  const rotaByKey = new Map<string, string[]>();
  for (const s of [...(shifts ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const key = `${s.staff_id}-${s.shift_date}`;
    if (!rotaByKey.has(key)) rotaByKey.set(key, []);
    rotaByKey.get(key)!.push(`${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`);
  }

  // Small clock-in / clock-out photos for the list (at most 200 rows signed).
  const photoPaths = (rows ?? []).slice(0, 200).flatMap((r) => [r.clock_in_photo, r.clock_out_photo]).filter((p): p is string => !!p);
  const urls = await signedPhotoUrls(photoPaths).catch(() => new Map<string, string>());

  return NextResponse.json({
    canEditLockedTimes: g.session.role === "admin",
    rows: (rows ?? []).map((r) => ({
      ...r,
      in_photo_url: r.clock_in_photo ? urls.get(r.clock_in_photo) ?? null : null,
      out_photo_url: r.clock_out_photo ? urls.get(r.clock_out_photo) ?? null : null,
      staff_name: nameById.get(r.staff_id) ?? "?",
      rota: rotaByKey.get(`${r.staff_id}-${r.work_date}`)?.join(", ") ?? null,
      // the one shift this session was clocked against (split-shift days)
      rota_shift: r.shift_id != null ? (rotaByShiftId.get(r.shift_id) ?? null) : null,
      is_stuck: !r.clock_out && !!r.clock_in && r.clock_in < staleBefore,
    })),
    staff: staff ?? [],
    pending,
  });
}

// POST — manual entry: a manager records a shift someone forgot to clock.
// Entering it is that shift's one change, so its times are locked from then.
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);

  const body = await req.json();
  const staffId = Number(body.staff_id);
  const workDate = String(body.work_date || "");
  const clockIn = body.clock_in ? new Date(body.clock_in).toISOString() : null;
  const clockOut = body.clock_out ? new Date(body.clock_out).toISOString() : null;
  if (!staffId || !workDate || !clockIn) {
    return NextResponse.json({ error: "Staff, date and clock-in are required" }, { status: 400 });
  }
  if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
    return NextResponse.json({ error: "Clock-out must be after clock-in" }, { status: 400 });
  }

  // Prevent an accidental second POST when the manager meant to edit an
  // existing session. Additional sessions must be an explicit UI choice.
  const { data: existingRows, error: existingError } = await db
    .from("attendance")
    .select("id, clock_in, clock_out")
    .eq("business_id", g.session.businessId)
    .eq("staff_id", staffId)
    .eq("work_date", workDate);
  if (existingError) return NextResponse.json({ error: "Could not check existing attendance" }, { status: 500 });
  if ((existingRows?.length ?? 0) > 0 && body.add_another_session !== true) {
    return NextResponse.json({ error: "Attendance already exists for this day. Edit an existing session or choose Add another session." }, { status: 409 });
  }
  const startMs = new Date(clockIn).getTime();
  const endMs = clockOut ? new Date(clockOut).getTime() : Number.POSITIVE_INFINITY;
  const overlapsExisting = (existingRows ?? []).some((row) => {
    if (!row.clock_in) return false;
    const existingStart = new Date(row.clock_in).getTime();
    const existingEnd = row.clock_out ? new Date(row.clock_out).getTime() : Number.POSITIVE_INFINITY;
    return startMs < existingEnd && existingStart < endMs;
  });
  if (overlapsExisting && body.confirm_overlap !== true) {
    return NextResponse.json({ error: "This session overlaps existing attendance. Confirm that the overlap is intentional." }, { status: 409 });
  }

  const settings = await getAttendanceSettings(g.session.businessId);
  const rota = await loadStaffRota(staffId);
  // split-shift day: the entry belongs to the shift nearest its clock-in
  const sched = await resolveScheduleFor(g.session.businessId, staffId, workDate, rota, settings, new Date(clockIn));

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

  const { data: inserted, error } = await db
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
      times_changed_at: new Date().toISOString(),
      times_changed_by: g.session.id,
      notes: body.notes || null,
      ...patch,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });

  await audit(g.session.id, "manual_entry", inserted.id, null, inserted);
  return NextResponse.json({ row: inserted }, { status: 201 });
}
