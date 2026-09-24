import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { canViewFoodSafety, canLogFoodSafety, canSignoffFoodSafety } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

// Everything the Tasks screen needs for "today" in one call: the active
// check/temp templates, whatever's already been logged against them today
// (reporting by exception — most items just show as "not yet done"), today's
// problems, and whether today's manager sign-off has happened.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewFoodSafety(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: staffRow } = await supabase.from("staff").select("can_signoff").eq("id", session.id).single();
  const canSignoff = canSignoffFoodSafety(session.role, staffRow?.can_signoff ?? false);
  const canLog = canLogFoodSafety(session.role);

  const settings = await getAttendanceSettings();
  const today = localDateString(new Date(), settings.timezone);
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  const [{ data: checkTypes }, { data: tempTypes }, { data: checkLogs }, { data: tempLogs }, { data: problems }, { data: signoff }] =
    await Promise.all([
      supabase.from("fs_check_type").select("*").eq("active", true).order("check_window").order("display_order"),
      supabase.from("fs_temp_type").select("*").eq("active", true).order("display_order"),
      supabase
        .from("fs_check_log")
        .select("id, check_type_id, ok, problem_note, staff_id, created_at, staff:staff(name)")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false }),
      supabase
        .from("fs_temp_log")
        .select("id, temp_type_id, value, pass, corrective_action, staff_id, created_at, staff:staff(name)")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false }),
      supabase
        .from("fs_problem")
        .select("id, what, action, staff_id, created_at, staff:staff(name)")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false }),
      supabase.from("fs_signoff").select("id, staff_id, created_at, staff:staff(name)").eq("day", today).maybeSingle(),
    ]);

  return NextResponse.json({
    today,
    permissions: { canLog, canSignoff },
    check_types: checkTypes ?? [],
    temp_types: tempTypes ?? [],
    check_logs: checkLogs ?? [],
    temp_logs: tempLogs ?? [],
    problems: problems ?? [],
    signoff: signoff ?? null,
  });
}
