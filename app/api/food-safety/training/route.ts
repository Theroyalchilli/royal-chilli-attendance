import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewTeamTraining, canRecordTraining } from "@/lib/food-safety-permissions";
import { storeCertificateFile } from "@/lib/food-safety-files";

export const dynamic = "force-dynamic";

// Whole-team version of /api/me/food-safety/training — same per-course
// status computation (not_done/overdue/soon/valid), just for every active
// member of staff instead of just the signed-in person.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewTeamTraining(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: staffRows }, { data: courses }, { data: records }] = await Promise.all([
    supabase.from("staff").select("id, name, role").eq("active", 1).neq("role", "hr").order("name"),
    supabase.from("fs_course").select("*").eq("active", true).order("name"),
    supabase
      .from("fs_training_record")
      .select("id, staff_id, course_id, level, date_done, trainer, certificate_ref")
      .order("date_done", { ascending: false }),
  ]);

  type TrainingRecord = NonNullable<typeof records>[number];
  const latestByStaffCourse = new Map<string, TrainingRecord>();
  for (const r of records ?? []) {
    const key = `${r.staff_id}:${r.course_id}`;
    if (!latestByStaffCourse.has(key)) latestByStaffCourse.set(key, r);
  }

  const today = new Date();
  const team = (staffRows ?? []).map((s) => {
    const items = (courses ?? []).map((c) => {
      const record = latestByStaffCourse.get(`${s.id}:${c.id}`) ?? null;
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
    return { staff: s, items };
  });

  return NextResponse.json({ team, courses: courses ?? [], can_record: canRecordTraining(session.role) });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRecordTraining(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { staff_id, course_id, level, date_done, trainer, certificate } = await req.json().catch(() => ({}));
  if (!staff_id || !course_id || !date_done) {
    return NextResponse.json({ error: "staff_id, course_id and date_done are required" }, { status: 400 });
  }

  let certificateRef: string | null = null;
  if (certificate) {
    const result = await storeCertificateFile(certificate, { staffId: staff_id, courseId: course_id });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    certificateRef = result.path;
  }

  const { error } = await supabase.from("fs_training_record").insert({
    staff_id,
    course_id,
    level: level || null,
    date_done,
    trainer: trainer || null,
    certificate_ref: certificateRef,
  });
  if (error) return NextResponse.json({ error: "Failed to save training record" }, { status: 500 });

  return NextResponse.json({ success: true });
}
