import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewFoodSafety } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

// Every active course, paired with the signed-in person's most recent
// record for it (if any) — a course with no record at all is its own
// "not done" state, same weight as an overdue one (see HANDOVER.md §9:
// a new hire with nothing recorded is the red-state demo, not a blank).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewFoodSafety(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: courses }, { data: records }] = await Promise.all([
    supabase.from("fs_course").select("*").eq("active", true).order("name"),
    supabase
      .from("fs_training_record")
      .select("id, course_id, level, date_done, trainer, certificate_ref, created_at")
      .eq("staff_id", session.id)
      .order("date_done", { ascending: false }),
  ]);

  type TrainingRecord = NonNullable<typeof records>[number];
  const latestByCourse = new Map<number, TrainingRecord>();
  for (const r of records ?? []) if (!latestByCourse.has(r.course_id)) latestByCourse.set(r.course_id, r);

  const today = new Date();
  const items = (courses ?? []).map((c) => {
    const record = latestByCourse.get(c.id) ?? null;
    let status: "not_done" | "overdue" | "soon" | "valid" = "not_done";
    let dueDate: string | null = null;
    if (record) {
      if (!c.refresh_months) {
        status = "valid";
      } else {
        const due = new Date(record.date_done);
        due.setMonth(due.getMonth() + c.refresh_months);
        dueDate = due.toISOString().slice(0, 10);
        const daysLeft = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
        status = daysLeft < 0 ? "overdue" : daysLeft <= 30 ? "soon" : "valid";
      }
    }
    return { course: c, record, status, due_date: dueDate };
  });

  return NextResponse.json({ items });
}
