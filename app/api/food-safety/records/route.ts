import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewFoodSafetyRecords } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

// Everything that happened on one day, in SFBB day-sheet order: sign-off
// status first (the legal headline), then checks by window, temps,
// problems, deliveries. This is deliberately a single day at a time — an
// official record is read/printed day by day, not as a rolled-up range.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewFoodSafetyRecords(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const [{ data: checkLogs }, { data: tempLogs }, { data: problems }, { data: deliveries }, { data: signoff }] = await Promise.all([
    supabase
      .from("fs_check_log")
      .select("id, ok, problem_note, created_at, check_type:fs_check_type(check_window, label), staff:staff(name)")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at"),
    supabase
      .from("fs_temp_log")
      .select("id, value, pass, corrective_action, created_at, temp_type:fs_temp_type(label, unit), staff:staff(name)")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at"),
    supabase
      .from("fs_problem")
      .select("id, what, action, created_at, staff:staff(name)")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at"),
    supabase
      .from("fs_delivery_check")
      .select("id, item, temp_value, accepted, corrective_action, created_at, supplier:suppliers(name), staff:staff(name)")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at"),
    supabase.from("fs_signoff").select("id, created_at, staff:staff(name)").eq("day", date).maybeSingle(),
  ]);

  return NextResponse.json({
    date,
    check_logs: checkLogs ?? [],
    temp_logs: tempLogs ?? [],
    problems: problems ?? [],
    deliveries: deliveries ?? [],
    signoff: signoff ?? null,
  });
}
