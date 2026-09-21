import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { localIsoWeekday, getAttendanceSettings, localDateString } from "@/lib/settings";

export const dynamic = "force-dynamic";

function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

// POST { week_start, mode: "defaults" | "copy_previous" }
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const { week_start: weekStart, mode } = await req.json();
  if (!weekStart) return NextResponse.json({ error: "week_start required" }, { status: 400 });
  const days = weekDays(weekStart);
  const settings = await getAttendanceSettings();
  const today = localDateString(new Date(), settings.timezone);
  if (days[6] < today) {
    return NextResponse.json({ error: "That week is in the past — Rota is read-only there" }, { status: 400 });
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("id, rota_start, rota_end, rota_working_days")
    .eq("active", 1);

  // never overwrite an existing shift for a staff+date
  const { data: existing } = await supabase
    .from("shifts")
    .select("staff_id, shift_date")
    .gte("shift_date", days[0])
    .lte("shift_date", days[6])
    .neq("status", "cancelled");
  const taken = new Set((existing ?? []).map((s) => `${s.staff_id}:${s.shift_date}`));

  // never schedule over approved leave
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("staff_id, start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", days[6])
    .gte("end_date", days[0]);
  const onLeave = (staffId: number, date: string) =>
    (leave ?? []).some((l) => l.staff_id === staffId && date >= l.start_date && date <= l.end_date);

  const inserts: {
    staff_id: number;
    shift_date: string;
    start_time: string;
    end_time: string;
    status: "scheduled";
    created_by: number;
  }[] = [];

  if (mode === "copy_previous") {
    const prevStart = new Date(weekStart + "T12:00:00Z");
    prevStart.setUTCDate(prevStart.getUTCDate() - 7);
    const prev = weekDays(prevStart.toISOString().slice(0, 10));
    const { data: prevShifts } = await supabase
      .from("shifts")
      .select("staff_id, shift_date, start_time, end_time")
      .gte("shift_date", prev[0])
      .lte("shift_date", prev[6])
      .neq("status", "cancelled");
    for (const s of prevShifts ?? []) {
      const idx = prev.indexOf(s.shift_date);
      if (idx < 0) continue;
      const target = days[idx];
      if (taken.has(`${s.staff_id}:${target}`) || onLeave(s.staff_id, target)) continue;
      inserts.push({
        staff_id: s.staff_id,
        shift_date: target,
        start_time: s.start_time,
        end_time: s.end_time,
        status: "scheduled",
        created_by: g.session.id,
      });
    }
  } else {
    // from each staff member's default rota
    for (const s of staff ?? []) {
      if (!s.rota_start || !s.rota_end) continue;
      const working: number[] = s.rota_working_days ?? [1, 2, 3, 4, 5];
      for (const date of days) {
        const [y, m, d] = date.split("-").map(Number);
        const wd = localIsoWeekday(new Date(Date.UTC(y, m - 1, d, 12)), settings.timezone);
        if (!working.includes(wd)) continue;
        if (taken.has(`${s.id}:${date}`) || onLeave(s.id, date)) continue;
        inserts.push({
          staff_id: s.id,
          shift_date: date,
          start_time: hhmm(s.rota_start)!,
          end_time: hhmm(s.rota_end)!,
          status: "scheduled",
          created_by: g.session.id,
        });
      }
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("shifts").insert(inserts);
    if (error) return NextResponse.json({ error: "Failed to write shifts" }, { status: 500 });
  }
  return NextResponse.json({ added: inserts.length });
}
