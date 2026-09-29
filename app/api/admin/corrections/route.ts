import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { requireManager } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  let q = db.from("attendance_corrections").select("*").order("created_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);

  const [{ data: rows, error }, { data: staff }] = await Promise.all([
    q,
    db.from("staff").select("id, name"),
  ]);
  if (error) return NextResponse.json({ error: "Failed to load" }, { status: 500 });

  const nameById = new Map((staff ?? []).map((s) => [s.id, s.name]));
  return NextResponse.json({
    rows: (rows ?? []).map((r) => ({ ...r, staff_name: nameById.get(r.staff_id) ?? "?" })),
  });
}
