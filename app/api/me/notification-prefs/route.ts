import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { getSessionFromRequest } from "@/lib/auth";
import { DEFAULT_PREFS, getPrefs, type Prefs } from "@/lib/notification-prefs";

export const dynamic = "force-dynamic";
const KEYS: (keyof Prefs)[] = ["rota", "requests", "team_late", "team_requests"];

// GET — my switches (defaults: everything on) + my phones with alerts on.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = bizDb(session.businessId);
  const prefs = (await getPrefs([session.id])).get(session.id) ?? DEFAULT_PREFS;
  const { data: devices } = await db
    .from("push_subscriptions")
    .select("endpoint, user_agent, created_at")
    .eq("staff_id", session.id)
    .order("created_at", { ascending: false });
  const isManager = ["supervisor", "manager", "hr", "admin"].includes(session.role);
  return NextResponse.json({ prefs, devices: devices ?? [], isManager });
}

// PUT { rota?, requests?, team_late?, team_requests? }
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = bizDb(session.businessId);
  const b = await req.json().catch(() => ({}));
  const current = (await getPrefs([session.id])).get(session.id) ?? DEFAULT_PREFS;
  const next: Prefs = { ...current };
  for (const k of KEYS) if (typeof b[k] === "boolean") next[k] = b[k];
  const { error } = await db
    .from("notification_prefs")
    .upsert({ staff_id: session.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "staff_id" });
  if (error) return NextResponse.json({ error: "Couldn't save — try again" }, { status: 500 });
  return NextResponse.json({ prefs: next });
}
