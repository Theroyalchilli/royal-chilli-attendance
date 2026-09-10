import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { assertCron } from "@/lib/cron";
import { getAttendanceSettings } from "@/lib/settings";
import { audit } from "@/lib/attendance-write";

export const dynamic = "force-dynamic";

// Daily (Hobby plan — one run/day): an attendance row still open long past any
// real shift almost always means someone forgot to clock out. Flag it for a
// manager (approval_status → pending, note appended) so it surfaces in
// /admin/attendance and the dashboard. The live dashboard already shows these
// in real time; this just makes the flag stick.
export async function GET(req: NextRequest) {
  const bad = assertCron(req);
  if (bad) return bad;

  const settings = await getAttendanceSettings();
  const cutoff = new Date(Date.now() - settings.missingClockoutHours * 3600_000).toISOString();

  const { data: stale } = await supabase
    .from("attendance")
    .select("id, staff_id, clock_in, notes, approval_status")
    .is("clock_out", null)
    .not("clock_in", "is", null)
    .lt("clock_in", cutoff)
    .neq("approval_status", "pending");

  let flagged = 0;
  for (const r of stale ?? []) {
    const note = `[auto ${new Date().toISOString().slice(0, 10)}] still clocked in after ${settings.missingClockoutHours}h — check`;
    await supabase
      .from("attendance")
      .update({
        approval_status: "pending",
        notes: r.notes ? `${r.notes}\n${note}` : note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    await audit(null, "auto_missing_clockout", r.id, null, { clock_in: r.clock_in });
    flagged++;
  }

  return NextResponse.json({ checked: stale?.length ?? 0, flagged });
}
