import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { deliverMessage, type Audience } from "@/lib/staff-messages";
import { requireSender } from "./guard";

export const dynamic = "force-dynamic";
const AUDIENCES: Audience[] = ["everyone", "today", "managers", "people"];

// GET — recent messages (sent + scheduled) and the staff list for "Chosen people".
export async function GET(req: NextRequest) {
  const g = await requireSender(req);
  if ("res" in g) return g.res;
  const [{ data: messages }, { data: staff }] = await Promise.all([
    supabase
      .from("staff_messages")
      .select("id, title, body, audience, staff_ids, send_at, sent_at, cancelled_at, recipients, phones, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("staff").select("id, name, role").eq("active", 1).order("name"),
  ]);
  const names = new Map((staff ?? []).map((s) => [s.id, s.name]));
  // read receipts: who has / hasn't opened each sent message
  const sentIds = (messages ?? []).filter((m) => m.sent_at).map((m) => m.id);
  const { data: receipts } = sentIds.length
    ? await supabase.from("notifications").select("message_id, staff_id, read_at").in("message_id", sentIds)
    : { data: [] as { message_id: number; staff_id: number; read_at: string | null }[] };
  const readBy = new Map<number, { read: string[]; unread: string[] }>();
  for (const r of receipts ?? []) {
    const e = readBy.get(r.message_id) ?? { read: [], unread: [] };
    (r.read_at ? e.read : e.unread).push(names.get(r.staff_id) ?? "Former staff");
    readBy.set(r.message_id, e);
  }
  return NextResponse.json({
    messages: (messages ?? []).map((m) => ({ ...m, created_by_name: names.get(m.created_by) ?? null, reads: readBy.get(m.id) ?? null })),
    staff: staff ?? [],
  });
}

// POST { title, body, audience, staff_ids?, send_at? } — send now, or schedule.
export async function POST(req: NextRequest) {
  const g = await requireSender(req);
  if ("res" in g) return g.res;
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim().slice(0, 80);
  const body = String(b.body || "").trim().slice(0, 500);
  const audience = b.audience as Audience;
  const staffIds: number[] = Array.isArray(b.staff_ids) ? b.staff_ids.map(Number).filter(Boolean) : [];
  if (!title || !body) return NextResponse.json({ error: "Add a title and a message" }, { status: 400 });
  if (!AUDIENCES.includes(audience)) return NextResponse.json({ error: "Choose who it goes to" }, { status: 400 });
  if (audience === "people" && staffIds.length === 0) return NextResponse.json({ error: "Choose at least one person" }, { status: 400 });

  let sendAt = new Date();
  if (b.send_at) {
    sendAt = new Date(b.send_at);
    if (Number.isNaN(sendAt.getTime())) return NextResponse.json({ error: "That date/time isn't valid" }, { status: 400 });
    if (sendAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "That time has already passed" }, { status: 400 });
  }
  const scheduled = sendAt.getTime() > Date.now() + 60_000;

  const { data: row, error } = await supabase
    .from("staff_messages")
    .insert({ title, body, audience, staff_ids: audience === "people" ? staffIds : null, send_at: sendAt.toISOString(), created_by: g.session.id })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ error: "Couldn't save the message" }, { status: 500 });

  if (scheduled) return NextResponse.json({ id: row.id, scheduled: true, send_at: sendAt.toISOString() }, { status: 201 });
  const result = await deliverMessage(row.id);
  return NextResponse.json({ id: row.id, scheduled: false, ...(result ?? { recipients: 0, phones: 0 }) }, { status: 201 });
}
