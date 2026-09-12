import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { notifyManagers } from "@/lib/notify";
import { getAttendanceSettings, localDateString } from "@/lib/settings";

export const dynamic = "force-dynamic";

// GET — my correction requests + my recent attendance rows to raise one against.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const settings = await getAttendanceSettings();
  const today = localDateString(new Date(), settings.timezone);

  const [{ data: mine }, { data: recentRows }] = await Promise.all([
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

  // Today should always be pickable, even before a punch happens (e.g. "I know
  // I'm leaving early today") — if there's no attendance row yet, offer a
  // synthetic entry (id -1) that the POST handler creates a real row for.
  const recent = recentRows ?? [];
  const hasToday = recent.some((r) => r.work_date === today);
  if (!hasToday) recent.unshift({ id: -1, work_date: today, clock_in: null, clock_out: null });

  return NextResponse.json({ requests: mine ?? [], recent });
}

// POST { attendance_id, clock_in?, clock_out?, reason } — raise a correction on
// one of my own attendance rows. Goes to the manager corrections queue.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  let attendanceId = Number(body.attendance_id);
  const reason = String(body.reason ?? "").trim();
  if (!attendanceId || !reason) {
    return NextResponse.json({ error: "Pick a day and say what's wrong" }, { status: 400 });
  }

  let row: { work_date: string; [k: string]: unknown } | null = null;

  if (attendanceId === -1) {
    // Sentinel from GET: today, no attendance row yet — create a blank one
    // (not_started, unclocked) so there's something real to attach the
    // correction request to; the manager's approval flow fills in the times.
    const settings = await getAttendanceSettings();
    const today = localDateString(new Date(), settings.timezone);
    const { data: created, error: createErr } = await supabase
      .from("attendance")
      .insert({ staff_id: session.id, work_date: today, status: "not_started", approval_status: "pending" })
      .select("*")
      .single();
    if (createErr || !created) return NextResponse.json({ error: "Couldn't start today's record" }, { status: 500 });
    row = created;
    attendanceId = created.id;
  } else {
    const { data: existingRow } = await supabase
      .from("attendance")
      .select("*")
      .eq("id", attendanceId)
      .eq("staff_id", session.id) // can only correct your own
      .maybeSingle();
    if (!existingRow) return NextResponse.json({ error: "That day isn't one of yours" }, { status: 404 });
    row = existingRow;
  }

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

  await notifyManagers("correction_submitted", `${session.name} raised a correction for ${row!.work_date}.`, "/admin/corrections");
  return NextResponse.json({ success: true }, { status: 201 });
}
