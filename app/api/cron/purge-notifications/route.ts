import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { assertCron } from "@/lib/cron";

export const dynamic = "force-dynamic";

// Daily: delete notifications older than 30 days, read or not. The bell and
// Notification history (My account → Notifications) show the last 30 days,
// and "Read by 6 of 9" on sent messages stays right for that long.
const KEEP_DAYS = 30;
export async function GET(req: NextRequest) {
  const bad = assertCron(req);
  if (bad) return bad;

  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 3600_000).toISOString();
  const { error, count } = await supabase
    .from("notifications")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) return NextResponse.json({ error: "Failed to purge" }, { status: 500 });

  return NextResponse.json({ deleted: count ?? 0 });
}
