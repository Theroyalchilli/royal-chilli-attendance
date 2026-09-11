import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { resolveScheduleFor, type StaffRota } from "@/lib/rota";
import { recompute, audit } from "@/lib/attendance-write";
import { storeClockPhoto } from "@/lib/photo";
import { checkGeofence } from "@/lib/geofence";

export const dynamic = "force-dynamic";

// GET — am I clocked in? (drives the button)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: open } = await supabase
    .from("attendance")
    .select("id, clock_in, net_work_seconds")
    .eq("staff_id", session.id)
    .is("clock_out", null)
    .not("clock_in", "is", null)
    .maybeSingle();

  const s = await getAttendanceSettings();
  return NextResponse.json({
    clocked_in: !!open,
    since: open?.clock_in ?? null,
    geofence: s.geofenceEnabled && s.restaurantLat != null,
  });
}

type Body = { photo?: string | null; lat?: number; lng?: number };

// POST — clock in or out for the signed-in person, from their own device.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as Body;
    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;

    const geo = await checkGeofence(lat, lng);
    if (!geo.ok) {
      const msg =
        geo.reason === "no_location"
          ? "Turn on location so we can check you're at the restaurant. Ask a manager if this is wrong."
          : `You're ${geo.distance}m away — you need to be within ${geo.radius}m of the restaurant. Ask a manager if this is wrong.`;
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    const settings = await getAttendanceSettings();
    const now = new Date();

    const { data: staff } = await supabase
      .from("staff")
      .select("name, rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes")
      .eq("id", session.id)
      .maybeSingle();
    const rota = (staff ?? {}) as StaffRota & { name?: string };

    const { data: openRow } = await supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", session.id)
      .is("clock_out", null)
      .not("clock_in", "is", null)
      .maybeSingle();

    if (openRow) {
      // ---- CLOCK OUT ----
      const sched = await resolveScheduleFor(session.id, openRow.work_date, rota, settings);
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
      const { data: updated, error } = await supabase
        .from("attendance")
        .update({
          clock_out: now.toISOString(),
          clock_out_method: "web",
          clock_out_photo: photoPath,
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
    const sched = await resolveScheduleFor(session.id, workDate, rota, settings);
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

    const { data: inserted, error } = await supabase
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
        return NextResponse.json({ action: "in", time: now.toISOString() });
      }
      throw error;
    }
    await audit(session.id, "clock_in", inserted.id, null, inserted);
    return NextResponse.json({ action: "in", time: now.toISOString(), late_seconds: patch.late_seconds });
  } catch (err) {
    console.error("me/punch error:", err);
    return NextResponse.json({ error: "Couldn't record that — try again" }, { status: 500 });
  }
}
