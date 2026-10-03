import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { getSessionFromRequest } from "@/lib/auth";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { forgottenClockOut, loadStaffRota, resolveScheduleFor, scheduleSlotsFor, type StaffRota } from "@/lib/rota";
import { recompute, audit } from "@/lib/attendance-write";
import { notify, notifyManagers } from "@/lib/notify";
import type { AttendanceSettings } from "@/lib/settings";
import { storeClockPhoto } from "@/lib/photo";
import { checkGeofence } from "@/lib/geofence";

export const dynamic = "force-dynamic";

const hm = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** Today's slots + the next one if `open` is a forgotten clock-out from an earlier shift. */
async function checkForgotten(
  staffId: number,
  open: { clock_in: string; scheduled_end: string | null; business_id: number },
  rota: StaffRota,
  settings: AttendanceSettings,
  now: Date,
) {
  if (!open.scheduled_end) return null;
  const slots = await scheduleSlotsFor(open.business_id, staffId, localDateString(now, settings.timezone), rota, settings);
  return forgottenClockOut(open, slots, now);
}

// GET — am I clocked in? (drives the button)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = bizDb(session.businessId);

  const { data: open } = await db
    .from("attendance")
    .select("id, clock_in, scheduled_end, net_work_seconds, business_id")
    .eq("staff_id", session.id)
    .is("clock_out", null)
    .not("clock_in", "is", null)
    .maybeSingle();

  const s = await getAttendanceSettings(session.businessId);
  // Split shift, forgot to clock out after the first half: the button should
  // offer "Clock In" for the next shift, not "Clock Out" with the gap hours.
  let forgot: { closes_at: string; next_start: string } | null = null;
  if (open) {
    const rota = await loadStaffRota(session.id);
    const next = await checkForgotten(session.id, open, rota, s, new Date());
    if (next) forgot = { closes_at: hm(new Date(open.scheduled_end!), s.timezone), next_start: hm(next.start, s.timezone) };
  }
  return NextResponse.json({
    clocked_in: !!open && !forgot,
    since: forgot ? null : (open?.clock_in ?? null),
    forgot,
    geofence: s.geofenceEnabled && s.restaurantLat != null,
  });
}

// face: the phone saw a face before taking the photo (true), or it
// couldn't check and the person tapped "Take photo" (false).
type Body = { photo?: string | null; face?: boolean | null; lat?: number; lng?: number };

// POST — clock in or out for the signed-in person, from their own device.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = bizDb(session.businessId);

    const body = (await req.json()) as Body;
    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;

    const geo = await checkGeofence(session.businessId, lat, lng);
    if (!geo.ok) {
      const msg =
        geo.reason === "no_location"
          ? "Turn on location so we can check you're at the restaurant. Ask a manager if this is wrong."
          : `You're ${geo.distance}m away — you need to be within ${geo.radius}m of the restaurant. Ask a manager if this is wrong.`;
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    const settings = await getAttendanceSettings(session.businessId);
    const now = new Date();

    const rota = await loadStaffRota<{ name: string }>(session.id, "name");

    const { data: openRow } = await db
      .from("attendance")
      .select("*")
      .eq("staff_id", session.id)
      .is("clock_out", null)
      .not("clock_in", "is", null)
      .maybeSingle();

    // ---- FORGOTTEN CLOCK-OUT (split shift) ----
    // Still open from an earlier shift that ended over an hour ago, and their
    // next shift is now: close the old session at its scheduled end, flag it
    // for a manager, then fall through and clock them in for this shift.
    let autoClosed: string | null = null;
    if (openRow && (await checkForgotten(session.id, openRow, rota, settings, now))) {
      const closeAt = openRow.scheduled_end as string;
      const sched = await resolveScheduleFor(openRow.business_id, session.id, openRow.work_date, rota, settings);
      const { patch } = recompute(
        {
          clockIn: openRow.clock_in,
          clockOut: closeAt,
          scheduledStart: openRow.scheduled_start,
          scheduledEnd: openRow.scheduled_end,
          breakOverrideMinutes: openRow.break_override_minutes,
          adjustmentSeconds: openRow.adjustment_seconds ?? 0,
          scheduleBreakMinutes: sched.breakMinutes,
          graceSeconds: sched.graceMinutes * 60,
        },
        settings,
      );
      const closeHM = hm(new Date(closeAt), settings.timezone);
      const note = `[auto ${localDateString(now, settings.timezone)}] forgot to clock out — closed at scheduled end ${closeHM} when clocking in for next shift. Check.`;
      const { data: closed, error: closeErr } = await db
        .from("attendance")
        .update({
          clock_out: closeAt,
          clock_out_method: "manual",
          status: "clocked_out",
          approval_status: "pending",
          notes: openRow.notes ? `${openRow.notes}
${note}` : note,
          updated_at: now.toISOString(),
          ...patch,
        })
        .eq("id", openRow.id)
        .is("clock_out", null)
        .select()
        .single();
      if (closeErr) throw closeErr;
      await audit(session.id, "auto_close_forgotten_clockout", openRow.id, openRow, closed);
      await notify(session.id, "missed_clockout", `You didn't clock out — we set it to ${closeHM} for your manager to check.`, "/me/attendance");
      await notifyManagers(
        openRow.business_id,
        "missed_clockout",
        `${rota.name ?? "Someone"} didn't clock out — set to ${closeHM}, please check.`,
        `/admin/attendance?staff_id=${session.id}&date=${openRow.work_date}&open=${openRow.id}`,
      );
      autoClosed = closeHM;
    } else if (openRow) {
      // ---- CLOCK OUT ----
      const sched = await resolveScheduleFor(openRow.business_id, session.id, openRow.work_date, rota, settings);
      const photoPath = await storeClockPhoto(body.photo, { staffId: session.id, leg: "out", workMonth: openRow.work_date.slice(0, 7) });
      const { patch } = recompute(
        {
          clockIn: openRow.clock_in,
          clockOut: now.toISOString(),
          scheduledStart: openRow.scheduled_start,
          scheduledEnd: openRow.scheduled_end,
          breakOverrideMinutes: openRow.break_override_minutes,
          adjustmentSeconds: openRow.adjustment_seconds ?? 0,
          scheduleBreakMinutes: sched.breakMinutes,
          graceSeconds: sched.graceMinutes * 60,
        },
        settings,
      );
      const { data: updated, error } = await db
        .from("attendance")
        .update({
          clock_out: now.toISOString(),
          clock_out_method: "web",
          clock_out_photo: photoPath,
          clock_out_face: photoPath ? body.face === true : null,
          clock_out_lat: lat,
          clock_out_lng: lng,
          status: "clocked_out",
          photo_missing: openRow.photo_missing || photoPath === null,
          updated_at: now.toISOString(),
          ...patch,
        })
        .eq("id", openRow.id)
        .is("clock_out", null)
        .select()
        .single();
      if (error) throw error;
      await audit(session.id, "clock_out", openRow.id, openRow, updated);
      return NextResponse.json({ action: "out", time: now.toISOString(), net_work_seconds: patch.net_work_seconds });
    }

    // ---- CLOCK IN ----
    const workDate = localDateString(now, settings.timezone);
    // split-shift day: pick the shift this clock-in belongs to (nearest start)
    const sched = await resolveScheduleFor(session.businessId, session.id, workDate, rota, settings, now);
    const photoPath = await storeClockPhoto(body.photo, { staffId: session.id, leg: "in", workMonth: workDate.slice(0, 7) });
    const { patch } = recompute(
      {
        clockIn: now.toISOString(),
        clockOut: null,
        scheduledStart: sched.scheduledStart?.toISOString() ?? null,
        scheduledEnd: sched.scheduledEnd?.toISOString() ?? null,
        breakOverrideMinutes: null,
        adjustmentSeconds: 0,
        scheduleBreakMinutes: sched.breakMinutes,
        graceSeconds: sched.graceMinutes * 60,
        now,
      },
      settings,
    );

    // Clocking in: at the business this login is working for.
    const { data: inserted, error } = await bizDb(session.businessId)
      .from("attendance")
      .insert({
        staff_id: session.id,
        work_date: workDate,
        shift_id: sched.shiftId,
        scheduled_start: sched.scheduledStart?.toISOString() ?? null,
        scheduled_end: sched.scheduledEnd?.toISOString() ?? null,
        clock_in: now.toISOString(),
        clock_in_method: "web",
        clock_in_photo: photoPath,
        clock_in_face: photoPath ? body.face === true : null,
        clock_in_lat: lat,
        clock_in_lng: lng,
        status: "clocked_in",
        photo_missing: photoPath === null,
        ...patch,
      })
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ action: "in", time: now.toISOString(), auto_closed_at: autoClosed });
      }
      throw error;
    }
    await audit(session.id, "clock_in", inserted.id, null, inserted);
    return NextResponse.json({ action: "in", time: now.toISOString(), late_seconds: patch.late_seconds, auto_closed_at: autoClosed });
  } catch (err) {
    console.error("me/punch error:", err);
    return NextResponse.json({ error: "Couldn't record that — try again" }, { status: 500 });
  }
}
