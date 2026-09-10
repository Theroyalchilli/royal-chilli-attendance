import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { notifyManagers } from "@/lib/notify";

export const dynamic = "force-dynamic";

// GET — my correction requests + my recent attendance rows to raise one against.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const [{ data: mine }, { data: recent }] = await Promise.all([
    supabase
      .from("attendance_corrections")
      .select("id, attendance_id, requested_change, reason, status, review_note, created_at, reviewed_at")
      .eq("staff_id", session.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, work_date, clock_in, clock_out")
      .eq("staff_id", session.id)
      .gte("work_date", thirtyDaysAgo)
      .order("work_date", { ascending: false }),
  ]);

  return NextResponse.json({ requests: mine ?? [], recent: recent ?? [] });
}

// POST { attendance_id, clock_in?, clock_out?, reason } — raise a correction on
// one of my own attendance rows. Goes to the manager corrections queue.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const attendanceId = Number(body.attendance_id);
  const reason = String(body.reason ?? "").trim();
  if (!attendanceId || !reason) {
    return NextResponse.json({ error: "Pick a day and say what's wrong" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("attendance")
    .select("*")
    .eq("id", attendanceId)
    .eq("staff_id", session.id) // can only correct your own
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "That day isn't one of yours" }, { status: 404 });

  const change: Record<string, string> = {};
  if (body.clock_in) change.clock_in = new Date(body.clock_in).toISOString();
  if (body.clock_out) change.clock_out = new Date(body.clock_out).toISOString();
  if (Object.keys(change).length === 0) {
    return NextResponse.json({ error: "Enter the corrected time(s)" }, { status: 400 });
  }

  // one open request per attendance row
  const { data: existing } = await supabase
    .from("attendance_corrections")
    .select("id")
    .eq("attendance_id", attendanceId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "You already have a pending request for that day" }, { status: 409 });
  }

  const { error } = await supabase.from("attendance_corrections").insert({
    attendance_id: attendanceId,
    staff_id: session.id,
    original_snapshot: row,
    requested_change: change,
    reason,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: "Couldn't submit" }, { status: 500 });

  await notifyManagers("correction_submitted", `${session.name} raised a correction for ${row.work_date}.`, "/admin/corrections");
  return NextResponse.json({ success: true }, { status: 201 });
}
