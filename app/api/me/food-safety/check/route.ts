import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canLogFoodSafety } from "@/lib/food-safety-permissions";

// Reporting by exception: ok=true needs nothing else; ok=false forces a
// problem_note — a fail with no explanation defeats the point of the record.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canLogFoodSafety(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { check_type_id, ok, problem_note } = await req.json().catch(() => ({}));
  if (!check_type_id || typeof ok !== "boolean") {
    return NextResponse.json({ error: "check_type_id and ok are required" }, { status: 400 });
  }
  if (!ok && !String(problem_note ?? "").trim()) {
    return NextResponse.json({ error: "A note is required when a check fails" }, { status: 400 });
  }

  const { error } = await supabase.from("fs_check_log").insert({
    check_type_id,
    staff_id: session.id,
    ok,
    problem_note: ok ? null : String(problem_note).trim(),
  });
  if (error) return NextResponse.json({ error: "Failed to log check" }, { status: 500 });

  return NextResponse.json({ success: true });
}
