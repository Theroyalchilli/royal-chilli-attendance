import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { getAttendanceSettings, localDateString, localIsoWeekday } from "@/lib/settings";

export const dynamic = "force-dynamic";

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** [from, to] (inclusive) for "day" | "week" (Mon–Sun) | "month" around `anchor`. */
function rangeFor(range: string, anchor: string): { from: string; to: string } {
  if (range === "week") {
    const weekday = new Date(anchor + "T12:00:00Z").getUTCDay(); // 0=Sun..6=Sat
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const from = addDays(anchor, mondayOffset);
    return { from, to: addDays(from, 6) };
  }
  if (range === "month") {
    const [y, m] = anchor.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from, to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
  }
  return { from: anchor, to: anchor }; // day
}

// GET ?range=day|week|month&date=YYYY-MM-DD — a single employee's attendance,
// corrections, this-week timesheet and full payroll history. Payroll is
// read-only here; every mutation stays in the POS.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const staffId = Number((await params).id);

  const settings = await getAttendanceSettings();
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "week";
  const anchor = searchParams.get("date") || localDateString(new Date(), settings.timezone);
  const { from, to } = rangeFor(range, anchor);

  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select(
      "id, name, role, employee_number, employment_type, pay_rate, active, rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes",
    )
    .eq("id", staffId)
    .maybeSingle();
  if (staffErr || !staff) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const [{ data: attendance }, { data: shifts }, { data: corrections }, { data: leave }, { data: entries }] =
    await Promise.all([
      supabase.from("attendance").select("*").eq("staff_id", staffId).gte("work_date", from).lte("work_date", to).order("work_date"),
      supabase.from("shifts").select("shift_date").eq("staff_id", staffId).gte("shift_date", from).lte("shift_date", to).neq("status", "cancelled"),
      supabase.from("attendance_corrections").select("*").eq("staff_id", staffId).order("created_at", { ascending: false }).limit(20),
      supabase.from("leave_requests").select("start_date, end_date").eq("staff_id", staffId).eq("status", "approved").lte("start_date", to).gte("end_date", from),
      supabase
        .from("payroll_entries")
        .select("id, payroll_period_id, hours_worked, gross_pay, paid_amount, status, created_at, payroll_periods(period_start, period_end)")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false }),
    ]);

  // --- summary over the range ---
  const attByDate = new Map((attendance ?? []).map((r) => [r.work_date, r]));
  const shiftDates = new Set((shifts ?? []).map((s) => s.shift_date));
  const leaveRanges = leave ?? [];
  const onLeave = (d: string) => leaveRanges.some((l) => l.start_date <= d && d <= l.end_date);

  const workingDays = staff.rota_working_days ?? [1, 2, 3, 4, 5];
  let cursor = from;
  let scheduledDays = 0;
  let absences = 0;
  while (cursor <= to) {
    const isScheduled =
      shiftDates.has(cursor) ||
      (!!staff.rota_start && !!staff.rota_end && workingDays.includes(localIsoWeekday(new Date(cursor + "T12:00:00Z"), settings.timezone)));
    if (isScheduled) {
      scheduledDays++;
      if (!attByDate.get(cursor)?.clock_in && !onLeave(cursor)) absences++;
    }
    cursor = addDays(cursor, 1);
  }

  let hoursSeconds = 0;
  let daysWorked = 0;
  let lateCount = 0;
  for (const r of attendance ?? []) {
    if (r.clock_out) {
      hoursSeconds += r.net_work_seconds ?? 0;
      daysWorked++;
    }
    if ((r.late_seconds ?? 0) > 0) lateCount++;
  }

  // --- this week's timesheet (locking is always weekly) ---
  const weekday0 = new Date(anchor + "T12:00:00Z").getUTCDay();
  const weekFrom = addDays(anchor, weekday0 === 0 ? -6 : 1 - weekday0);
  const weekTo = addDays(weekFrom, 6);
  const { data: timesheet } = await supabase
    .from("timesheets")
    .select("*")
    .eq("staff_id", staffId)
    .eq("period_start", weekFrom)
    .eq("period_end", weekTo)
    .maybeSingle();

  // --- payroll: full history, read-only ---
  const entryList = entries ?? [];
  const entryIds = entryList.map((e) => e.id);
  type PaymentRow = { payroll_entry_id: number; amount: number; method: string | null; paid_at: string; notes: string | null };
  const payments: PaymentRow[] = entryIds.length
    ? ((
        await supabase
          .from("payroll_payments")
          .select("payroll_entry_id, amount, method, paid_at, notes")
          .in("payroll_entry_id", entryIds)
          .order("paid_at", { ascending: true })
      ).data as PaymentRow[] | null) ?? []
    : [];
  const paymentsByEntry = new Map<number, PaymentRow[]>();
  for (const p of payments) {
    if (!paymentsByEntry.has(p.payroll_entry_id)) paymentsByEntry.set(p.payroll_entry_id, []);
    paymentsByEntry.get(p.payroll_entry_id)!.push(p);
  }
  const payroll = entryList.map((e) => {
    const period = e.payroll_periods as unknown as { period_start: string; period_end: string } | null;
    const gross = Number(e.gross_pay ?? 0);
    const paid = Number(e.paid_amount ?? 0);
    return {
      id: e.id,
      period_start: period?.period_start ?? null,
      period_end: period?.period_end ?? null,
      hours_worked: Number(e.hours_worked ?? 0),
      gross_pay: gross,
      paid_amount: paid,
      outstanding: Math.round((gross - paid) * 100) / 100,
      status: e.status,
      payments: paymentsByEntry.get(e.id) ?? [],
    };
  });
  const grossTotal = payroll.reduce((s, p) => s + p.gross_pay, 0);
  const paidTotal = payroll.reduce((s, p) => s + p.paid_amount, 0);

  return NextResponse.json({
    staff,
    range: { range, from, to },
    summary: {
      hours_seconds: hoursSeconds,
      days_worked: daysWorked,
      scheduled_days: scheduledDays,
      late_count: lateCount,
      absences,
      gross_pay: Math.round(grossTotal * 100) / 100,
      outstanding_pay: Math.round((grossTotal - paidTotal) * 100) / 100,
    },
    attendance: attendance ?? [],
    corrections: corrections ?? [],
    timesheet: timesheet ?? null,
    week: { from: weekFrom, to: weekTo },
    payroll,
  });
}
