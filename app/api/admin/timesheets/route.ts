import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";

export const dynamic = "force-dynamic";

type Totals = {
  net_seconds: number;
  regular_seconds: number;
  overtime_seconds: number;
  break_seconds: number;
  late_seconds: number;
  days_worked: number;
};

function sumRows(rows: { net_work_seconds: number; regular_seconds: number; overtime_seconds: number; break_seconds: number; late_seconds: number; clock_out: string | null }[]): Totals {
  const t: Totals = { net_seconds: 0, regular_seconds: 0, overtime_seconds: 0, break_seconds: 0, late_seconds: 0, days_worked: 0 };
  for (const r of rows) {
    if (!r.clock_out) continue; // only closed shifts count
    t.net_seconds += r.net_work_seconds ?? 0;
    t.regular_seconds += r.regular_seconds ?? 0;
    t.overtime_seconds += r.overtime_seconds ?? 0;
    t.break_seconds += r.break_seconds ?? 0;
    t.late_seconds += r.late_seconds ?? 0;
    t.days_worked += 1;
  }
  return t;
}

// GET ?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const { searchParams } = new URL(req.url);
  const ps = searchParams.get("period_start");
  const pe = searchParams.get("period_end");
  if (!ps || !pe) return NextResponse.json({ error: "period_start and period_end required" }, { status: 400 });

  const [{ data: sheets }, { data: staff }, { data: att }] = await Promise.all([
    supabase.from("timesheets").select("*").eq("period_start", ps).eq("period_end", pe),
    supabase.from("staff").select("id, name, pay_rate").eq("active", 1).order("name"),
    supabase.from("attendance").select("staff_id, work_date, net_work_seconds, regular_seconds, overtime_seconds, break_seconds, late_seconds, clock_in, clock_out").gte("work_date", ps).lte("work_date", pe),
  ]);

  const sheetByStaff = new Map((sheets ?? []).map((s) => [s.staff_id, s]));
  const attByStaff = new Map<number, typeof att>();
  for (const r of att ?? []) {
    if (!attByStaff.has(r.staff_id)) attByStaff.set(r.staff_id, []);
    attByStaff.get(r.staff_id)!.push(r);
  }

  const list = (staff ?? []).map((s) => {
    const rows = attByStaff.get(s.id) ?? [];
    return {
      staff_id: s.id,
      staff_name: s.name,
      pay_rate: s.pay_rate,
      live_totals: sumRows(rows),
      days: rows.sort((a, b) => a.work_date.localeCompare(b.work_date)),
      sheet: sheetByStaff.get(s.id) ?? null,
    };
  });

  return NextResponse.json({ period_start: ps, period_end: pe, list });
}

// POST { period_start, period_end } — (re)generate a timesheet per active staff.
export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const { period_start: ps, period_end: pe } = await req.json();
  if (!ps || !pe) return NextResponse.json({ error: "period_start and period_end required" }, { status: 400 });

  const [{ data: staff }, { data: att }, { data: existing }] = await Promise.all([
    supabase.from("staff").select("id").eq("active", 1),
    supabase.from("attendance").select("staff_id, net_work_seconds, regular_seconds, overtime_seconds, break_seconds, late_seconds, clock_out").gte("work_date", ps).lte("work_date", pe),
    supabase.from("timesheets").select("id, staff_id, locked").eq("period_start", ps).eq("period_end", pe),
  ]);

  const lockedStaff = new Set((existing ?? []).filter((e) => e.locked).map((e) => e.staff_id));
  const attByStaff = new Map<number, typeof att>();
  for (const r of att ?? []) {
    if (!attByStaff.has(r.staff_id)) attByStaff.set(r.staff_id, []);
    attByStaff.get(r.staff_id)!.push(r);
  }

  let written = 0;
  let skipped = 0;
  for (const s of staff ?? []) {
    if (lockedStaff.has(s.id)) {
      skipped++;
      continue;
    }
    const totals = sumRows(attByStaff.get(s.id) ?? []);
    await supabase.from("timesheets").upsert(
      {
        staff_id: s.id,
        period_start: ps,
        period_end: pe,
        status: "draft",
        totals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,period_start,period_end" },
    );
    written++;
  }

  return NextResponse.json({ written, skipped });
}
