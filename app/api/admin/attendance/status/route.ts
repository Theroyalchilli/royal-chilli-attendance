import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";
import { getAttendanceSettings } from "@/lib/settings";
import { resolveScheduled } from "@/lib/time-engine";
import { notify } from "@/lib/notify";
import { ABSENT_AFTER_MINUTES, LEAVE_TYPE_LABEL, SHIFT_LEAVE_TYPES, type ShiftLeaveType } from "@/lib/shift-actions";

// POST { shift_id, action, leave_type?, reason? } — the Attendance "Choose…" menu.
//   absent  → shift "missed" (from 30 min after the start)
//   leave   → approved one-day leave: sick / holiday / unpaid (any time)
//   cancel  → shift "cancelled": off the rota, no alerts ("Shift not needed")
//   undo    → reverses any of those
// Older callers: "sick_leave" = leave/sick, "undo_absent" = undo.
// Missed shifts stay on the rota; approved leave stays in leave_requests.
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);
  const body = await req.json().catch(() => null);
  const shiftId = Number(body?.shift_id);
  let action = body?.action;
  let leaveType: ShiftLeaveType | null = SHIFT_LEAVE_TYPES.includes(body?.leave_type) ? body.leave_type : null;
  if (action === "sick_leave") { action = "leave"; leaveType = "sick"; }
  if (action === "undo_absent") action = "undo";
  if (!Number.isInteger(shiftId) || shiftId <= 0 || !["absent", "leave", "cancel", "undo"].includes(action) || (action === "leave" && !leaveType)) {
    return NextResponse.json({ error: "Pick a valid shift status" }, { status: 400 });
  }

  const { data: shift, error: shiftError } = await db.from("shifts").select("*").eq("id", shiftId).maybeSingle();
  if (shiftError) return NextResponse.json({ error: "Couldn't load the rota shift" }, { status: 500 });
  if (!shift || (shift.status === "cancelled" && action !== "undo")) return NextResponse.json({ error: "Rota shift not found" }, { status: 404 });

  const [{ data: linkedAttendance, error: linkedError }, { data: dayAttendance, error: dayAttendanceError }, { data: dayShifts, error: shiftsError }, { data: timeOff, error: leaveError }] = await Promise.all([
    db.from("attendance").select("id").eq("shift_id", shiftId),
    db.from("attendance").select("id, shift_id").eq("staff_id", shift.staff_id).eq("work_date", shift.shift_date).is("shift_id", null),
    db.from("shifts").select("id").eq("staff_id", shift.staff_id).eq("shift_date", shift.shift_date).neq("status", "cancelled"),
    db.from("leave_requests").select("*")
      .eq("staff_id", shift.staff_id).lte("start_date", shift.shift_date).gte("end_date", shift.shift_date),
  ]);
  if (linkedError || dayAttendanceError || shiftsError || leaveError) return NextResponse.json({ error: "Couldn't check the shift records" }, { status: 500 });
  const hasAttendance = !!linkedAttendance?.length || ((dayShifts?.length ?? 0) === 1 && !!dayAttendance?.length);
  if (action !== "undo" && hasAttendance) return NextResponse.json({ error: "This shift already has an attendance record" }, { status: 409 });

  const settings = await getAttendanceSettings(g.session.businessId);
  const sched = resolveScheduled(shift.shift_date, shift.start_time.slice(0, 5), shift.end_time.slice(0, 5), settings.timezone);
  const when = `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)} shift on ${shift.shift_date}`;
  const approved = (timeOff ?? []).filter((r) => r.status === "approved");
  // Optional note: saved on the leave, or in the audit log for absent / not needed.
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) || null : null;

  if (action === "undo") {
    if (shift.status === "missed" || shift.status === "cancelled") {
      const { data: updated, error } = await db.from("shifts").update({ status: "scheduled" }).eq("id", shiftId).select().single();
      if (error) return NextResponse.json({ error: "Couldn't undo it" }, { status: 500 });
      if (shift.status === "missed") {
        await audit(g.session.id, "shift_absence_undone", shiftId, shift, updated);
      } else {
        await audit(g.session.id, "shift_cancel_undone", shiftId, shift, updated);
        await notify(shift.staff_id, "shift_changed", `Your ${when} is back on the rota.`, "/me/rota");
      }
      return NextResponse.json({ ok: true, state: "pending" });
    }
    const leave = approved[0];
    if (!leave) return NextResponse.json({ error: "Nothing to undo on this shift" }, { status: 409 });
    if (approved.length > 1 || leave.start_date !== shift.shift_date || leave.end_date !== shift.shift_date) {
      return NextResponse.json({ error: "This leave covers more than one day. Change it on the Leave page." }, { status: 409 });
    }
    const { error } = await db.from("leave_requests").delete().eq("id", leave.id);
    if (error) return NextResponse.json({ error: "Couldn't undo the leave" }, { status: 500 });
    await audit(g.session.id, "attendance_leave_undone", leave.id, leave, null);
    await notify(shift.staff_id, "leave_reviewed", `${LEAVE_TYPE_LABEL[leave.leave_type as ShiftLeaveType] ?? "Leave"} for ${shift.shift_date} was removed by your manager.`, "/me/requests?tab=leave");
    return NextResponse.json({ ok: true, state: "pending" });
  }

  // absent / leave / cancel: only on a shift that's still just scheduled
  if (shift.status === "missed") return NextResponse.json({ error: "Undo the absence first" }, { status: 409 });
  if (approved.length) return NextResponse.json({ error: "Approved leave already covers this date. Refresh Attendance to see it." }, { status: 409 });
  if (timeOff?.some((r) => r.status === "pending")) return NextResponse.json({ error: "Review the pending leave request for this date first" }, { status: 409 });

  if (action === "absent") {
    if (Date.now() < sched.start.getTime() + ABSENT_AFTER_MINUTES * 60_000) {
      return NextResponse.json({ error: `A shift can be marked absent from ${ABSENT_AFTER_MINUTES} minutes after it starts` }, { status: 400 });
    }
    const { data: updated, error } = await db.from("shifts").update({ status: "missed" }).eq("id", shiftId).select().single();
    if (error) return NextResponse.json({ error: "Couldn't record the absence" }, { status: 500 });
    await audit(g.session.id, "shift_absence_recorded", shiftId, shift, { ...updated, reason });
    return NextResponse.json({ ok: true, state: "absent" });
  }

  if (action === "cancel") {
    const { data: updated, error } = await db.from("shifts").update({ status: "cancelled" }).eq("id", shiftId).select().single();
    if (error) return NextResponse.json({ error: "Couldn't take the shift off the rota" }, { status: 500 });
    await audit(g.session.id, "shift_cancelled", shiftId, shift, { ...updated, reason });
    await notify(shift.staff_id, "shift_changed", `Your ${when} isn't needed. It's been taken off the rota.`, "/me/rota");
    return NextResponse.json({ ok: true, state: "cancelled" });
  }

  const now = new Date().toISOString();
  const { data: leave, error } = await db.from("leave_requests").insert({
    staff_id: shift.staff_id,
    leave_type: leaveType,
    start_date: shift.shift_date,
    end_date: shift.shift_date,
    reason,
    status: "approved",
    decided_by: g.session.id,
    decided_at: now,
  }).select().single();
  if (error) return NextResponse.json({ error: "Couldn't record the leave" }, { status: 500 });
  await audit(g.session.id, leaveType === "sick" ? "attendance_sick_leave_recorded" : "attendance_leave_recorded", leave.id, null, leave);
  await notify(shift.staff_id, "leave_reviewed", `${LEAVE_TYPE_LABEL[leaveType!]} for ${shift.shift_date} was recorded by your manager.`, "/me/requests?tab=leave");
  return NextResponse.json({ ok: true, state: leaveType === "holiday" ? "holiday" : "leave", leave_type: leaveType }, { status: 201 });
}
