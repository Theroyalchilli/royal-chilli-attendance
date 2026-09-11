import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";
import { getAttendanceSettings, localDateString } from "@/lib/settings";

// Clear a scheduled shift (mark the day OFF).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);

  const { data: shift } = await supabase.from("shifts").select("shift_date").eq("id", id).maybeSingle();
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await getAttendanceSettings();
  const today = localDateString(new Date(), settings.timezone);
  if (shift.shift_date < today) {
    return NextResponse.json({ error: "Can't change a shift for a date that's already passed" }, { status: 400 });
  }

  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  await audit(g.session.id, "rota_shift_delete", id, null, null);
  return NextResponse.json({ success: true });
}
