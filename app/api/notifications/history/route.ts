import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { KINDS } from "@/lib/notification-kinds";

export const dynamic = "force-dynamic";
const PAGE = 30;

// GET ?q=&group=message|shift|request&range=week|month|all&before=<iso>
// My notifications from the last 30 days (older ones are cleared daily),
// including ones I swiped away — newest first, 30 at a time.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim().replace(/[%_,()]/g, " ").slice(0, 60);
  const group = sp.get("group");
  const range = sp.get("range") || "all";
  const before = sp.get("before");

  let query = supabase
    .from("notifications")
    .select("id, type, title, message, message_id, link, read_at, deleted_at, created_at")
    .eq("staff_id", session.id)
    .order("created_at", { ascending: false })
    .limit(PAGE + 1);
  if (group === "message" || group === "shift" || group === "request") {
    query = query.in("type", Object.entries(KINDS).filter(([, k]) => k.group === group).map(([t]) => t));
  }
  if (range === "week" || range === "month") {
    const days = range === "week" ? 7 : 30;
    query = query.gte("created_at", new Date(Date.now() - days * 24 * 3600_000).toISOString());
  }
  if (before) query = query.lt("created_at", before);
  if (q) query = query.or(`title.ilike.%${q}%,message.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Couldn't load history" }, { status: 500 });
  const rows = data ?? [];
  return NextResponse.json({ items: rows.slice(0, PAGE), more: rows.length > PAGE });
}
