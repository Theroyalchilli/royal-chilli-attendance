import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — the signed-in person's own payroll entries (POS payroll) with the
// period dates and each recorded payment. Read-only; always scoped to self.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: entries } = await supabase
    .from("payroll_entries")
    .select("id, payroll_period_id, hours_worked, gross_pay, paid_amount, status, created_at, payroll_periods(period_start, period_end)")
    .eq("staff_id", session.id)
    .order("created_at", { ascending: false });

  type PaymentRow = { payroll_entry_id: number; amount: number; method: string | null; paid_at: string; notes: string | null };
  const list = entries ?? [];
  const ids = list.map((e) => e.id);
  const payments: PaymentRow[] = ids.length
    ? ((
        await supabase
          .from("payroll_payments")
          .select("payroll_entry_id, amount, method, paid_at, notes")
          .in("payroll_entry_id", ids)
          .order("paid_at", { ascending: true })
      ).data as PaymentRow[] | null) ?? []
    : [];

  const payByEntry = new Map<number, PaymentRow[]>();
  for (const p of payments) {
    if (!payByEntry.has(p.payroll_entry_id)) payByEntry.set(p.payroll_entry_id, []);
    payByEntry.get(p.payroll_entry_id)!.push(p);
  }

  return NextResponse.json({
    payslips: list.map((e) => {
      const period = e.payroll_periods as unknown as { period_start: string; period_end: string } | null;
      return {
        id: e.id,
        period_start: period?.period_start ?? null,
        period_end: period?.period_end ?? null,
        hours_worked: Number(e.hours_worked ?? 0),
        gross_pay: Number(e.gross_pay ?? 0),
        paid_amount: Number(e.paid_amount ?? 0),
        outstanding: Math.round((Number(e.gross_pay ?? 0) - Number(e.paid_amount ?? 0)) * 100) / 100,
        status: e.status,
        payments: (payByEntry.get(e.id) ?? []).map((p) => ({
          amount: Number(p.amount),
          method: p.method,
          paid_at: p.paid_at,
          notes: p.notes,
        })),
      };
    }),
  });
}
