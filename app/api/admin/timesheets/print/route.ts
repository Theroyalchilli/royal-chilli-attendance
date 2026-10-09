import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { getBusiness, staffIdsAt } from "@/lib/business";
import { requireManager } from "@/lib/guard";
import { hm } from "@/lib/format";

export const dynamic = "force-dynamic";

// POST { period_start, period_end } — prints the week's hours on the till's
// 80mm printer: a ready-made "text" ticket in print_jobs (POS migration 114),
// picked up by the Print Station / CloudPRNT like any kitchen ticket. Per
// person: total hours, then each day worked. Same figures as the Timesheets
// page (the generated timesheet if there is one, else the live total).

const WIDTH = 48; // 80mm paper, normal font
type Line = { text: string; align?: "center"; bold?: boolean; size?: "tall" };

const row = (left: string, right: string) => {
  const room = WIDTH - right.length - 1;
  const l = left.length > room ? left.slice(0, room) : left;
  return l + " ".repeat(WIDTH - l.length - right.length) + right;
};
const DIVIDER = "-".repeat(WIDTH);
const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

type Att = { staff_id: number; work_date: string; net_work_seconds: number | null; clock_in: string | null; clock_out: string | null };

export async function POST(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const businessId = g.session.businessId;
  const db = bizDb(businessId);
  const { period_start: ps, period_end: pe } = await req.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ps ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(pe ?? "")) {
    return NextResponse.json({ error: "period_start and period_end required" }, { status: 400 });
  }

  const [{ data: sheets }, { data: staff }, { data: att }, business] = await Promise.all([
    db.from("timesheets").select("staff_id, totals").eq("period_start", ps).eq("period_end", pe),
    db.from("staff").select("id, name").eq("active", 1).in("id", await staffIdsAt(businessId)).order("name"),
    db.from("attendance").select("staff_id, work_date, net_work_seconds, clock_in, clock_out").gte("work_date", ps).lte("work_date", pe).order("work_date").order("clock_in"),
    getBusiness(businessId).catch(() => null),
  ]);

  const sheetTotal = new Map((sheets ?? []).map((s) => [s.staff_id, Number((s.totals as { net_seconds?: number } | null)?.net_seconds ?? NaN)]));
  const byStaff = new Map<number, Att[]>();
  for (const r of (att ?? []) as Att[]) {
    if (!r.clock_out) continue; // only finished shifts count
    if (!byStaff.has(r.staff_id)) byStaff.set(r.staff_id, []);
    byStaff.get(r.staff_id)!.push(r);
  }

  const t: Line[] = [
    { text: business?.name ?? "Hours", align: "center", bold: true },
    { text: "HOURS", align: "center", bold: true, size: "tall" },
    { text: `${day(ps)} - ${day(pe)}`, align: "center" },
    { text: `Printed ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`, align: "center" },
    { text: DIVIDER },
  ];

  let total = 0;
  let people = 0;
  for (const s of staff ?? []) {
    const rows = byStaff.get(s.id) ?? [];
    const live = rows.reduce((sum, r) => sum + (r.net_work_seconds ?? 0), 0);
    const fromSheet = sheetTotal.get(s.id);
    const net = Number.isFinite(fromSheet) ? (fromSheet as number) : live;
    if (!rows.length && !net) continue; // didn't work this week
    people++;
    total += net;
    t.push({ text: row(s.name, hm(net)), bold: true });
    for (const r of rows) {
      t.push({ text: row(`  ${day(r.work_date)}  ${r.clock_in ? time(r.clock_in) : "--:--"}-${r.clock_out ? time(r.clock_out) : "--:--"}`, hm(r.net_work_seconds)) });
    }
    t.push({ text: "" });
  }
  if (people === 0) t.push({ text: "No hours recorded this week.", align: "center" }, { text: "" });
  t.push({ text: DIVIDER }, { text: row(`TOTAL (${people} ${people === 1 ? "person" : "people"})`, hm(total)), bold: true });

  const { error } = await db.from("print_jobs").insert({ kind: "text", content: JSON.stringify(t) });
  if (error) {
    console.error("Print hours failed:", error.message);
    return NextResponse.json({ error: "Couldn't send it to the printer" }, { status: 500 });
  }
  return NextResponse.json({ success: true, people });
}
