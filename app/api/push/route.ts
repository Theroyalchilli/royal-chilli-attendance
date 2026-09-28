import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { pushConfigured, sendPush, vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

// GET — the public key the phone needs to subscribe, and whether this person
// already has notifications on for at least one device.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("staff_id", session.id);
  return NextResponse.json({ enabled: pushConfigured(), publicKey: vapidPublicKey(), devices: count ?? 0 });
}

// POST { subscription, test? } — save this phone; `test` sends a "you're all set" alert.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const sub = b.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      staff_id: session.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "Couldn't save — try again" }, { status: 500 });
  if (b.test) {
    await sendPush([session.id], { title: "Notifications are on ✓", body: "You'll get shift reminders and rota updates here.", url: "/", tag: "welcome" });
  }
  return NextResponse.json({ success: true });
}

// DELETE { endpoint } — turn notifications off for this phone.
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.endpoint) await supabase.from("push_subscriptions").delete().eq("staff_id", session.id).eq("endpoint", String(b.endpoint));
  return NextResponse.json({ success: true });
}
