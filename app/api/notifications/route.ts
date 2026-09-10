import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — the signed-in person's recent notifications + unread count.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("notifications")
    .select("id, type, message, link, read_at, created_at")
    .eq("staff_id", session.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const items = data ?? [];
  return NextResponse.json({ items, unread: items.filter((n) => !n.read_at).length });
}

// PATCH { id } | { all: true } — mark one / all read.
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  let q = supabase.from("notifications").update({ read_at: now }).eq("staff_id", session.id).is("read_at", null);
  if (!body.all) {
    if (!body.id) return NextResponse.json({ error: "id or all required" }, { status: 400 });
    q = q.eq("id", Number(body.id));
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
