import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { getAttendanceSettings, localDateString } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const settings = await getAttendanceSettings();
  const now = new Date();
  const today = localDateString(now, settings.timezone);
  const staleBefore = new Date(now.getTime() - settings.missingClockoutHours * 3600_000).toISOString();

  const [{ data: staffRows }, { data: todays }, { data: open }] = await Promise.all([
    supabase.from("staff").select("id, name").eq("active", 1),
    supabase
      .from("attendance")
      .select("*")
      .eq("work_date", today)
      .order("clock_in", { ascending: true }),
    supabase
      .from("attendance")
      .select("*")
      .is("clock_out", null)
      .not("clock_in", "is", null),
  ]);

  const nameById = new Map((staffRows ?? []).map((s) => [s.id, s.name]));
  const withName = <T extends { staff_id: number }>(r: T) => ({ ...r, staff_name: nameById.get(r.staff_id) ?? "?" });

  const onShift = (open ?? []).map(withName);
  const stuck = onShift.filter((r) => r.clock_in && r.clock_in < staleBefore);
  const lateToday = (todays ?? []).filter((r) => (r.late_seconds ?? 0) > 0).map(withName);
  const clockedOutToday = (todays ?? []).filter((r) => r.clock_out).map(withName);
  const pendingCorrections = (
    await supabase.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending")
  ).count;

  return NextResponse.json({
    today,
    timezone: settings.timezone,
    counts: {
      onShift: onShift.length,
      clockedOutToday: clockedOutToday.length,
      lateToday: lateToday.length,
      stuck: stuck.length,
      pendingCorrections: pendingCorrections ?? 0,
    },
    onShift,
    stuck,
    lateToday,
  });
}
