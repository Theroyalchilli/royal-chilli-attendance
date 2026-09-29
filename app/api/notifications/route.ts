import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — the signed-in person's recent notifications + unread count.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = bizDb(session.businessId);

  const { data } = await db
    .from("notifications")
    .select("id, type, title, message, message_id, link, read_at, created_at")
    .eq("staff_id", session.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);

  const items = data ?? [];
  return NextResponse.json({ items, unread: items.filter((n) => !n.read_at).length });
}

// PATCH { id } | { all: true } — mark one / all read. { delete: id } — swiped
// away: hidden for this person (kept, marked read, so read receipts stay right).
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = bizDb(session.businessId);

  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  if (body.delete) {
    const { data: row } = await db.from("notifications").select("read_at").eq("id", Number(body.delete)).eq("staff_id", session.id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.from("notifications").update({ deleted_at: now, read_at: row.read_at ?? now }).eq("id", Number(body.delete)).eq("staff_id", session.id);
    return NextResponse.json({ success: true });
  }
  let q = db.from("notifications").update({ read_at: now }).eq("staff_id", session.id).is("read_at", null);
  if (!body.all) {
    if (!body.id) return NextResponse.json({ error: "id or all required" }, { status: 400 });
    q = q.eq("id", Number(body.id));
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
