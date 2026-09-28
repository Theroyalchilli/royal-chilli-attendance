import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { loadStaffRota } from "@/lib/rota";

export const dynamic = "force-dynamic";

function weekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// GET ?week_start=YYYY-MM-DD — the signed-in person's own shifts for that week,
// plus their default rota pattern for days with no explicit shift.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekStart = new URL(req.url).searchParams.get("week_start");
  if (!weekStart) return NextResponse.json({ error: "week_start required" }, { status: 400 });
  const days = weekDays(weekStart);

  const [{ data: shifts }, me, { data: leave }] = await Promise.all([
    supabase
      .from("shifts")
      .select("shift_date, start_time, end_time")
      .order("start_time")
      .eq("staff_id", session.id)
      .gte("shift_date", days[0])
      .lte("shift_date", days[6])
      .neq("status", "cancelled"),
    loadStaffRota(session.id),
    supabase
      .from("leave_requests")
      .select("start_date, end_date, leave_type")
      .eq("staff_id", session.id)
      .eq("status", "approved")
      .lte("start_date", days[6])
      .gte("end_date", days[0]),
  ]);

  return NextResponse.json({
    days,
    shifts: shifts ?? [],
    rota: {
      rota_start: me.rota_start,
      rota_end: me.rota_end,
      rota_start_2: me.rota_start_2 ?? null,
      rota_end_2: me.rota_end_2 ?? null,
      rota_working_days: me.rota_working_days,
    },
    leave: leave ?? [],
  });
}
