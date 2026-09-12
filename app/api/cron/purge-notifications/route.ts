import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { assertCron } from "@/lib/cron";

export const dynamic = "force-dynamic";

// Daily: delete every notification older than 24 hours, read or not — the
// bell is for "what just happened", not an archive. Keeps it from growing
// stale and cluttered.
export async function GET(req: NextRequest) {
  const bad = assertCron(req);
  if (bad) return bad;

  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { error, count } = await supabase
    .from("notifications")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) return NextResponse.json({ error: "Failed to purge" }, { status: 500 });

  return NextResponse.json({ deleted: count ?? 0 });
}
