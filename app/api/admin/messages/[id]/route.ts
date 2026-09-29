import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { requireSender } from "../guard";

// DELETE — cancel a message that hasn't been sent yet.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireSender(req);
  if ("res" in g) return g.res;
  const db = bizDb(g.session.businessId);
  const id = Number((await params).id);
  const { data } = await db
    .from("staff_messages")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .is("sent_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (!data?.length) return NextResponse.json({ error: "Already sent or cancelled" }, { status: 409 });
  return NextResponse.json({ success: true });
}
