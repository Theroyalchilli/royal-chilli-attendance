import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { assertCron } from "@/lib/cron";
import { getAttendanceSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "attendance-photos";

// Daily: delete clock photos older than the retention window (default 60 days)
// and null their DB references. Photos live under "<YYYY-MM>/…", so anything in
// a month folder older than the cutoff month is safe to drop wholesale.
export async function GET(req: NextRequest) {
  const bad = assertCron(req);
  if (bad) return bad;

  const settings = await getAttendanceSettings();
  const cutoff = new Date(Date.now() - settings.photoRetentionDays * 86400_000);
  const cutoffMonth = cutoff.toISOString().slice(0, 7); // "YYYY-MM"

  const { data: folders } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  let deleted = 0;

  for (const folder of folders ?? []) {
    if (!/^\d{4}-\d{2}$/.test(folder.name) || folder.name >= cutoffMonth) continue;
    const { data: files } = await supabase.storage.from(BUCKET).list(folder.name, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${folder.name}/${f.name}`);
    if (paths.length === 0) continue;
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (!error) {
      deleted += paths.length;
      // clear the now-dead DB references for that month
      await supabase
        .from("attendance")
        .update({ clock_in_photo: null, clock_out_photo: null, photo_missing: true })
        .like("work_date", `${folder.name}-%`);
    }
  }

  return NextResponse.json({ cutoff_month: cutoffMonth, deleted });
}
