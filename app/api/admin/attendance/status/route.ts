import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";
import { getAttendanceSettings } from "@/lib/settings";
import { resolveScheduled } from "@/lib/time-engine";
import { notify } from "@/lib/notify";

// POST { shift_id, action: "absent" | "undo_absent" | "sick_leave", reason? }
// Missed shifts stay on the rota; approved leave stays in leave_requests.
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);
  const body = await req.json().catch(() => null);
  const shiftId = Number(body?.shift_id);
  const action = body?.action;
  if (!Number.isInteger(shiftId) || shiftId <= 0 || !["absent", "undo_absent", "sick_leave"].includes(action)) {
    return NextResponse.json({ error: "Pick a valid shift status" }, { status: 400 });
  }

  const { data: shift, error: shiftError } = await db.from("shifts").select("*").eq("id", shiftId).maybeSingle();
  if (shiftError) return NextResponse.json({ error: "Couldn't load the rota shift" }, { status: 500 });
  if (!shift || shift.status === "cancelled") return NextResponse.json({ error: "Rota shift not found" }, { status: 404 });

  const [{ data: linkedAttendance, error: linkedError }, { data: dayAttendance, error: dayAttendanceError }, { data: dayShifts, error: shiftsError }, { data: timeOff, error: leaveError }] = await Promise.all([
    db.from("attendance").select("id").eq("shift_id", shiftId),
    db.from("attendance").select("id, shift_id").eq("staff_id", shift.staff_id).eq("work_date", shift.shift_date).is("shift_id", null),
    db.from("shifts").select("id").eq("staff_id", shift.staff_id).eq("shift_date", shift.shift_date).neq("status", "cancelled"),
    db.from("leave_requests").select("id, status, leave_type")
      .eq("staff_id", shift.staff_id).lte("start_date", shift.shift_date).gte("end_date", shift.shift_date),
  ]);
  if (linkedError || dayAttendanceError || shiftsError || leaveError) return NextResponse.json({ error: "Couldn't check the shift records" }, { status: 500 });
  const hasAttendance = !!linkedAttendance?.length || ((dayShifts?.length ?? 0) === 1 && !!dayAttendance?.length);
  if (action !== "undo_absent" && hasAttendance) return NextResponse.json({ error: "This shift already has an attendance record" }, { status: 409 });

  if (action === "absent") {
    if (shift.status === "missed") return NextResponse.json({ error: "This shift is already recorded as missed" }, { status: 409 });
    const settings = await getAttendanceSettings(g.session.businessId);
    const end = resolveScheduled(shift.shift_date, shift.start_time.slice(0, 5), shift.end_time.slice(0, 5), settings.timezone).end;
    if (end > new Date()) return NextResponse.json({ error: "A shift can be marked absent after its scheduled end" }, { status: 400 });
    if (timeOff?.some((r) => r.status === "approved")) return NextResponse.json({ error: "Approved leave covers this date. Refresh Attendance to see it." }, { status: 409 });
    if (timeOff?.some((r) => r.status === "pending")) return NextResponse.json({ error: "Review the pending leave request for this date first" }, { status: 409 });

    const { data: updated, error } = await db.from("shifts").update({ status: "missed" }).eq("id", shiftId).select().single();
    if (error) return NextResponse.json({ error: "Couldn't record the absence" }, { status: 500 });
    await audit(g.session.id, "shift_absence_recorded", shiftId, shift, updated);
    return NextResponse.json({ ok: true, state: "absent" });
  }

  if (action === "undo_absent") {
    if (shift.status !== "missed") return NextResponse.json({ error: "This shift isn't marked absent" }, { status: 409 });
    const { data: updated, error } = await db.from("shifts").update({ status: "scheduled" }).eq("id", shiftId).select().single();
    if (error) return NextResponse.json({ error: "Couldn't undo the absence" }, { status: 500 });
    await audit(g.session.id, "shift_absence_undone", shiftId, shift, updated);
    return NextResponse.json({ ok: true, state: "pending" });
  }

  const settings = await getAttendanceSettings(g.session.businessId);
  if (shift.status === "missed") return NextResponse.json({ error: "Undo the absence first, then record sick leave" }, { status: 409 });
  const end = resolveScheduled(shift.shift_date, shift.start_time.slice(0, 5), shift.end_time.slice(0, 5), settings.timezone).end;
  if (end > new Date()) return NextResponse.json({ error: "Sick leave can be recorded after the scheduled shift ends" }, { status: 400 });
  if (timeOff?.some((r) => r.status === "approved")) return NextResponse.json({ error: "Approved leave already covers this date" }, { status: 409 });
  if (timeOff?.some((r) => r.status === "pending")) return NextResponse.json({ error: "Review the pending leave request for this date first" }, { status: 409 });

  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) || null : null;
  const now = new Date().toISOString();
  const { data: leave, error } = await db.from("leave_requests").insert({
    staff_id: shift.staff_id,
    leave_type: "sick",
    start_date: shift.shift_date,
    end_date: shift.shift_date,
    reason,
    status: "approved",
    decided_by: g.session.id,
    decided_at: now,
  }).select().single();
  if (error) return NextResponse.json({ error: "Couldn't record sick leave" }, { status: 500 });
  await audit(g.session.id, "attendance_sick_leave_recorded", leave.id, null, leave);
  await notify(shift.staff_id, "leave_reviewed", `Sick leave for ${shift.shift_date} was recorded by your manager.`, "/me/requests?tab=leave");
  return NextResponse.json({ ok: true, state: "leave", leave_type: "sick" }, { status: 201 });
}
