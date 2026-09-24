import { NextRequest, NextResponse } from "next/server";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set
// on the project. Reject anything else so the endpoints aren't publicly runnable.
// Locally (no CRON_SECRET in .env.local) that check is skipped so these routes
// stay easy to hit by hand while testing — but in production, missing the
// secret fails CLOSED rather than silently leaving the route open to the
// public internet. If this ever logs, CRON_SECRET didn't make it into
// Vercel's production env vars.
export function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set in production — refusing this cron request rather than leaving it open.");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null; // not configured, non-production — allow (dev / first setup)
  }
  if (req.headers.get("authorization") === `Bearer ${secret}`) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
