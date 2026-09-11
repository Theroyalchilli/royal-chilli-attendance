import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";
import { getAttendanceSettings, localDateString } from "@/lib/settings";

export const dynamic = "force-dynamic";

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

  const weekStart = new URL(req.url).searchParams.get("week_start");
  if (!weekStart) return NextResponse.json({ error: "week_start required" }, { status: 400 });
  const days = weekDays(weekStart);
  const weekEnd = days[6];

  const [{ data: staff }, { data: shifts }, { data: leave }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, rota_start, rota_end, rota_working_days")
      .eq("active", 1)
      .order("name"),
    supabase
      .from("shifts")
      .select("id, staff_id, shift_date, start_time, end_time, position, notes, status")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd)
      .neq("status", "cancelled"),
    supabase
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

// POST { staff_id, shift_date, start_time, end_time, position?, notes? }
// One shift per staff+date: updates the existing row if there is one.
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const b = await req.json();
  const staffId = Number(b.staff_id);
  const date = String(b.shift_date || "");
  const start = String(b.start_time || "");
  const end = String(b.end_time || "");
  if (!staffId || !date || !start || !end) {
    return NextResponse.json({ error: "staff, date, start and end are required" }, { status: 400 });
  }

  const settings = await getAttendanceSettings();
  const today = localDateString(new Date(), settings.timezone);
  if (date < today) {
    return NextResponse.json({ error: "Can't schedule a shift for a date that's already passed" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("shifts")
    .select("id")
    .eq("staff_id", staffId)
    .eq("shift_date", date)
    .neq("status", "cancelled")
    .maybeSingle();

  const row = {
    staff_id: staffId,
    shift_date: date,
    start_time: start,
    end_time: end,
    position: b.position || null,
    notes: b.notes || null,
    status: "scheduled" as const,
  };

  if (existing) {
    const { error } = await supabase.from("shifts").update(row).eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    await audit(g.session.id, "rota_shift_update", existing.id, null, row);
    return NextResponse.json({ id: existing.id });
  }

  const { data: created, error } = await supabase
    .from("shifts")
    .insert({ ...row, created_by: g.session.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Create failed" }, { status: 500 });
  await audit(g.session.id, "rota_shift_create", created.id, null, row);
  return NextResponse.json({ id: created.id }, { status: 201 });
}
