import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { decimalHours, clockTime } from "@/lib/format";

export const dynamic = "force-dynamic";

// GET ?type=hours|attendance|late&from=&to=&staff_id=&format=json|csv
export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "hours";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const staffId = searchParams.get("staff_id");
  const format = searchParams.get("format") ?? "json";

  let q = supabase.from("attendance").select("*").order("work_date").order("staff_id");
  if (from) q = q.gte("work_date", from);
  if (to) q = q.lte("work_date", to);
  if (staffId) q = q.eq("staff_id", Number(staffId));

  const [{ data: rows }, { data: staff }] = await Promise.all([
    q,
    supabase.from("staff").select("id, name"),
  ]);
  const nameById = new Map((staff ?? []).map((s) => [s.id, s.name]));

  let columns: { key: string; header: string }[];
  let data: Record<string, string | number>[];

  if (type === "attendance") {
    columns = [
      { key: "employee", header: "Employee" },
      { key: "date", header: "Date" },
      { key: "in", header: "Clock in" },
      { key: "out", header: "Clock out" },
      { key: "hours", header: "Net hours" },
      { key: "status", header: "Status" },
    ];
    data = (rows ?? []).map((r) => ({
      employee: nameById.get(r.staff_id) ?? "?",
      date: r.work_date,
      in: clockTime(r.clock_in),
      out: clockTime(r.clock_out),
      hours: decimalHours(r.net_work_seconds),
      status: r.status,
    }));
  } else if (type === "late") {
    columns = [
      { key: "employee", header: "Employee" },
      { key: "date", header: "Date" },
      { key: "in", header: "Clock in" },
      { key: "late_minutes", header: "Late (min)" },
    ];
    data = (rows ?? [])
      .filter((r) => (r.late_seconds ?? 0) > 0)
      .map((r) => ({
        employee: nameById.get(r.staff_id) ?? "?",
        date: r.work_date,
        in: clockTime(r.clock_in),
        late_minutes: Math.round((r.late_seconds ?? 0) / 60),
      }));
  } else {
    columns = [
      { key: "employee", header: "Employee" },
      { key: "date", header: "Date" },
      { key: "regular", header: "Regular h" },
      { key: "overtime", header: "Overtime h" },
      { key: "break", header: "Break h" },
      { key: "net", header: "Net h" },
    ];
    data = (rows ?? []).map((r) => ({
      employee: nameById.get(r.staff_id) ?? "?",
      date: r.work_date,
      regular: decimalHours(r.regular_seconds),
      overtime: decimalHours(r.overtime_seconds),
      break: decimalHours(r.break_seconds),
      net: decimalHours(r.net_work_seconds),
    }));
  }

  if (format === "csv") {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      columns.map((c) => esc(c.header)).join(","),
      ...data.map((row) => columns.map((c) => esc(row[c.key] ?? "")).join(",")),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${type}-${from ?? "all"}-to-${to ?? "all"}.csv"`,
      },
    });
  }

  return NextResponse.json({ columns, data });
}
