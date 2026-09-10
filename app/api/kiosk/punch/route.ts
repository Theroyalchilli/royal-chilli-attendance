import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { resolveScheduleFor, type StaffRota } from "@/lib/rota";
import { recompute, audit } from "@/lib/attendance-write";
import { storeClockPhoto } from "@/lib/photo";

export const dynamic = "force-dynamic";

type Body = {
  staff_id?: number;
  pin?: string;
  photo?: string | null; // data URL
  client_uuid?: string;
};

type KioskStaff = {
  id: number;
  name: string;
  active: number;
  pin_hash: string | null;
  pin_fail_count: number | null;
  pin_locked_until: string | null;
  rota_start: string | null;
  rota_end: string | null;
  rota_working_days: number[] | null;
  rota_break_minutes: number | null;
  rota_grace_minutes: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const staffId = Number(body.staff_id);
    const pin = String(body.pin ?? "");
    const clientUuid = String(body.client_uuid ?? "").trim();

    if (!staffId || !/^\d{4,6}$/.test(pin) || !clientUuid) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const settings = await getAttendanceSettings();

    // ---- idempotent replay (offline queue) --------------------------------
    const { data: dupe } = await supabase
      .from("attendance")
      .select("id, staff_id, clock_in, clock_out, clock_in_client_uuid, clock_out_client_uuid")
      .or(`clock_in_client_uuid.eq.${clientUuid},clock_out_client_uuid.eq.${clientUuid}`)
      .maybeSingle();
    if (dupe) {
      const wasOut = dupe.clock_out_client_uuid === clientUuid;
      const { data: s } = await supabase.from("staff").select("name").eq("id", dupe.staff_id).maybeSingle();
      return NextResponse.json({
        action: wasOut ? "out" : "in",
        name: s?.name ?? "",
        time: wasOut ? dupe.clock_out : dupe.clock_in,
        replayed: true,
      });
    }

    // ---- load + verify --------------------------------------------------
    const { data: staffRaw } = await supabase
      .from("staff")
      .select(
        "id, name, active, pin_hash, pin_fail_count, pin_locked_until, rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes",
      )
      .eq("id", staffId)
      .maybeSingle();
    const staff = staffRaw as unknown as KioskStaff | null;
    if (!staff || !staff.active || !staff.pin_hash) {
      return NextResponse.json({ error: "Unknown staff member" }, { status: 404 });
    }

    if (staff.pin_locked_until && new Date(staff.pin_locked_until) > new Date()) {
      const mins = Math.ceil((new Date(staff.pin_locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `PIN locked. Try again in ${mins} min or ask a manager.` },
        { status: 423 },
      );
    }

    const ok = await bcrypt.compare(pin, staff.pin_hash);
    if (!ok) {
      const nextCount = (staff.pin_fail_count ?? 0) + 1;
      if (nextCount >= settings.kioskPinMaxAttempts) {
        await supabase
          .from("staff")
          .update({
            pin_fail_count: 0,
            pin_locked_until: new Date(Date.now() + settings.kioskPinLockoutMinutes * 60000).toISOString(),
          })
          .eq("id", staffId);
        return NextResponse.json(
          { error: `Too many wrong PINs. Locked for ${settings.kioskPinLockoutMinutes} min.` },
          { status: 423 },
        );
      }
      await supabase.from("staff").update({ pin_fail_count: nextCount }).eq("id", staffId);
      return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
    }

    if (staff.pin_fail_count || staff.pin_locked_until) {
      await supabase.from("staff").update({ pin_fail_count: 0, pin_locked_until: null }).eq("id", staffId);
    }

    const rota: StaffRota = {
      rota_start: staff.rota_start,
      rota_end: staff.rota_end,
      rota_working_days: staff.rota_working_days,
      rota_break_minutes: staff.rota_break_minutes,
      rota_grace_minutes: staff.rota_grace_minutes,
    };

    // ---- clock in or out ----------------------------------------------
    const now = new Date();
    const { data: openRow } = await supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", staffId)
      .is("clock_out", null)
      .not("clock_in", "is", null)
      .maybeSingle();

    if (openRow) {
      // ---- CLOCK OUT ----
      const sched = await resolveScheduleFor(staffId, openRow.work_date, rota, settings);
      const photoPath = await storeClockPhoto(body.photo, {
        staffId,
        leg: "out",
        workMonth: openRow.work_date.slice(0, 7),
      });
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

      const { data: updated, error: upErr } = await supabase
        .from("attendance")
        .update({
          clock_out: now.toISOString(),
          clock_out_method: "kiosk",
          clock_out_photo: photoPath,
          clock_out_client_uuid: clientUuid,
          status: "clocked_out",
          photo_missing: openRow.photo_missing || photoPath === null,
          updated_at: now.toISOString(),
          ...patch,
        })
        .eq("id", openRow.id)
        .is("clock_out", null)
        .select()
        .single();
      if (upErr) throw upErr;

      await audit(staffId, "clock_out", openRow.id, openRow, updated);
      return NextResponse.json({
        action: "out",
        name: staff.name,
        time: now.toISOString(),
        net_work_seconds: patch.net_work_seconds,
      });
    }

    // ---- CLOCK IN ----
    const workDate = localDateString(now, settings.timezone);
    const sched = await resolveScheduleFor(staffId, workDate, rota, settings);
    const photoPath = await storeClockPhoto(body.photo, {
      staffId,
      leg: "in",
      workMonth: workDate.slice(0, 7),
    });
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

    const { data: inserted, error: insErr } = await supabase
      .from("attendance")
      .insert({
        staff_id: staffId,
        work_date: workDate,
        shift_id: sched.shiftId,
        scheduled_start: sched.scheduledStart?.toISOString() ?? null,
        scheduled_end: sched.scheduledEnd?.toISOString() ?? null,
        clock_in: now.toISOString(),
        clock_in_method: "kiosk",
        clock_in_photo: photoPath,
        clock_in_client_uuid: clientUuid,
        status: "clocked_in",
        photo_missing: photoPath === null,
        ...patch,
      })
      .select()
      .single();

    if (insErr) {
      // 23505 = the "one open shift per staff" unique index — a concurrent punch
      // already opened one. Treat as success (idempotent-ish).
      if ((insErr as { code?: string }).code === "23505") {
        return NextResponse.json({ action: "in", name: staff.name, time: now.toISOString() });
      }
      throw insErr;
    }

    await audit(staffId, "clock_in", inserted.id, null, inserted);
    return NextResponse.json({
      action: "in",
      name: staff.name,
      time: now.toISOString(),
      late_seconds: patch.late_seconds,
    });
  } catch (err) {
    console.error("kiosk punch error:", err);
    return NextResponse.json({ error: "Punch failed" }, { status: 500 });
  }
}
