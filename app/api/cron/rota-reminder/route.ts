import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron";
import { sendRotaReminders } from "@/lib/rota-reminder";

export const dynamic = "force-dynamic";

// Vercel crons (vercel.json): ?stage=first on Friday (managers), ?stage=final
// on Sunday evening (managers + group owner) — only if next week has no shifts.
export async function GET(req: NextRequest) {
  const bad = assertCron(req);
  if (bad) return bad;
  const stage = new URL(req.url).searchParams.get("stage") === "final" ? "final" : "first";
  const reminded = await sendRotaReminders(stage);
  return NextResponse.json({ stage, reminded });
}
