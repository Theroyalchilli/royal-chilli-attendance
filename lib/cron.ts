import { NextRequest, NextResponse } from "next/server";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set
// on the project. Reject anything else so the endpoints aren't publicly runnable.
export function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // not configured — allow (dev / first setup)
  if (req.headers.get("authorization") === `Bearer ${secret}`) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
