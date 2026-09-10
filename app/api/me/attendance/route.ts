import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — the signed-in person's clock sessions
// (raw, straight from their punches) + totals for the range.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const { data } = await supabase
    .from("attendance")
    .select("id, work_date, clock_in, clock_out, clock_in_method, net_work_seconds, regular_seconds, overtime_seconds, break_seconds, late_seconds, status")
    .eq("staff_id", session.id)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: false });

  const rows = data ?? [];
  const closed = rows.filter((r) => r.clock_out);
  const totals = {
    net_seconds: closed.reduce((s, r) => s + (r.net_work_seconds ?? 0), 0),
    overtime_seconds: closed.reduce((s, r) => s + (r.overtime_seconds ?? 0), 0),
    break_seconds: closed.reduce((s, r) => s + (r.break_seconds ?? 0), 0),
    days_worked: closed.length,
    late_count: rows.filter((r) => (r.late_seconds ?? 0) > 0).length,
  };

  return NextResponse.json({ rows, totals });
}
