import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";

// Clear a scheduled shift (mark the day OFF).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  await audit(g.session.id, "rota_shift_delete", id, null, null);
  return NextResponse.json({ success: true });
}
