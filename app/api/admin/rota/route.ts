import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import supabase from "@/lib/supabase";
import { staffIdsAt } from "@/lib/business";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";
import { alertShiftAdded, alertShiftChanged } from "@/lib/rota-alerts";
import { getAttendanceSettings, localDateString } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Usual patterns for the modal's defaults. Falls back to the single-slot
// columns until POS migration 066 (rota_start_2/rota_end_2) has been run.
// Staff who work at this business.
async function loadActiveStaffRotas(businessId: number) {
  const here = await staffIdsAt(businessId);
  const cols = "id, name, rota_start, rota_end, rota_working_days";
  const r = await supabase.from("staff").select(`${cols}, rota_start_2, rota_end_2`).eq("active", 1).in("id", here).order("name");
  if (!r.error) return r;
  return supabase.from("staff").select(cols).eq("active", 1).in("id", here).order("name");
}

function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// GET ?week_start=YYYY-MM-DD (Monday)
export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);

  const weekStart = new URL(req.url).searchParams.get("week_start");
  if (!weekStart) return NextResponse.json({ error: "week_start required" }, { status: 400 });
  const days = weekDays(weekStart);
  const weekEnd = days[6];

  const [{ data: staff }, { data: shifts }, { data: leave }] = await Promise.all([
    loadActiveStaffRotas(g.session.businessId),
    db
      .from("shifts")
      .select("id, staff_id, shift_date, start_time, end_time, position, notes, status")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd)
      .neq("status", "cancelled"),
    db
      .from("leave_requests")
      .select("staff_id, start_date, end_date, leave_type")
      .eq("status", "approved")
      .lte("start_date", weekEnd)
      .gte("end_date", weekStart),
  ]);

  return NextResponse.json({
    week_start: weekStart,
    days,
    staff: staff ?? [],
    shifts: shifts ?? [],
    leave: leave ?? [],
  });
}

/** "HH:MM" → [startMin, endMin) with an overnight end rolled past 24h. */
function span(start: string, end: string): [number, number] {
  const m = (t: string) => {
    const [h, mm] = t.slice(0, 5).split(":").map(Number);
    return h * 60 + mm;
  };
  const s = m(start);
  let e = m(end);
  if (e <= s) e += 1440;
  return [s, e];
}
const hhmm = (t: string) => t.slice(0, 5);

// POST { id?, staff_id, shift_date, start_time, end_time, position?, notes? }
// With `id`, edits that shift; without, adds another shift to the day — a
// split-shift day (06:00–10:00 + 17:00–00:00) is just two rows. Shifts for
// the same person and day may not overlap.
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);

  const b = await req.json();
  const id = b.id ? Number(b.id) : null;
  const staffId = Number(b.staff_id);
  const date = String(b.shift_date || "");
  const start = String(b.start_time || "");
  const end = String(b.end_time || "");
  if (!staffId || !date || !start || !end) {
    return NextResponse.json({ error: "staff, date, start and end are required" }, { status: 400 });
  }
  if (hhmm(start) === hhmm(end)) {
    return NextResponse.json({ error: "Start and end can't be the same time" }, { status: 400 });
  }

  const settings = await getAttendanceSettings(g.session.businessId);
  const today = localDateString(new Date(), settings.timezone);
  if (date < today) {
    return NextResponse.json({ error: "Can't schedule a shift for a date that's already passed" }, { status: 400 });
  }

  const { data: sameDay } = await db
    .from("shifts")
    .select("id, start_time, end_time")
    .eq("staff_id", staffId)
    .eq("shift_date", date)
    .neq("status", "cancelled");

  const [ns, ne] = span(start, end);
  const clash = (sameDay ?? []).find((s) => {
    if (s.id === id) return false;
    const [os, oe] = span(s.start_time, s.end_time);
    return ns < oe && os < ne;
  });
  if (clash) {
    return NextResponse.json(
      { error: `Overlaps their ${hhmm(clash.start_time)}–${hhmm(clash.end_time)} shift that day` },
      { status: 400 },
    );
  }

  const row = {
    staff_id: staffId,
    shift_date: date,
    start_time: start,
    end_time: end,
    position: b.position || null,
    notes: b.notes || null,
    status: "scheduled" as const,
  };

  if (id) {
    if (!(sameDay ?? []).some((s) => s.id === id)) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    const before = (sameDay ?? []).find((s) => s.id === id)!;
    const { error } = await db.from("shifts").update(row).eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    await audit(g.session.id, "rota_shift_update", id, null, row);
    await alertShiftChanged(staffId, date, before.start_time, before.end_time, start, end);
    return NextResponse.json({ id });
  }

  const { data: created, error } = await db
    .from("shifts")
    .insert({ ...row, created_by: g.session.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Create failed" }, { status: 500 });
  await audit(g.session.id, "rota_shift_create", created.id, null, row);
  await alertShiftAdded(staffId, date, start, end);
  return NextResponse.json({ id: created.id }, { status: 201 });
}
