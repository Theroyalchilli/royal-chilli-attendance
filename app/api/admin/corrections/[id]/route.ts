import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { recomputeAndSave } from "@/lib/recompute-row";
import { audit } from "@/lib/attendance-write";
import { notify } from "@/lib/notify";

const APPLIABLE = new Set([
  "clock_in",
  "clock_out",
  "break_override_minutes",
  "adjustment_seconds",
  "notes",
]);

// PATCH { action: "approve" | "reject", review_note? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);
  const { action, review_note } = await req.json();

  const { data: corr } = await supabase.from("attendance_corrections").select("*").eq("id", id).maybeSingle();
  if (!corr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (corr.status !== "pending") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  if (action === "reject") {
    await supabase
      .from("attendance_corrections")
      .update({ status: "rejected", reviewed_by: g.session.id, reviewed_at: new Date().toISOString(), review_note: review_note || null })
      .eq("id", id);
    await audit(g.session.id, "correction_rejected", id, corr, null);
    await notify(corr.staff_id, "correction_reviewed", "Your correction request was declined.", "/me/corrections");
    return NextResponse.json({ success: true });
  }

  if (action !== "approve") return NextResponse.json({ error: "Bad action" }, { status: 400 });
  if (!corr.attendance_id) return NextResponse.json({ error: "Correction has no attendance row" }, { status: 400 });

  const change = corr.requested_change as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(change)) {
    if (!APPLIABLE.has(k)) continue;
    if (k === "clock_in" || k === "clock_out") patch[k] = v ? new Date(v as string).toISOString() : null;
    else if (k === "break_override_minutes") patch[k] = v == null ? null : Math.max(0, Number(v));
    else if (k === "adjustment_seconds") patch[k] = Math.round(Number(v) || 0);
    else patch[k] = v;
  }

  const { data: attBefore } = await supabase.from("attendance").select("*").eq("id", corr.attendance_id).maybeSingle();
  patch.updated_at = new Date().toISOString();
  await supabase.from("attendance").update(patch).eq("id", corr.attendance_id);
  const updated = await recomputeAndSave(corr.attendance_id);

  await supabase
    .from("attendance_corrections")
    .update({ status: "approved", reviewed_by: g.session.id, reviewed_at: new Date().toISOString(), review_note: review_note || null })
    .eq("id", id);

  await audit(g.session.id, "correction_approved", corr.attendance_id, attBefore, updated);
  await notify(corr.staff_id, "correction_reviewed", "Your correction request was approved.", "/me/corrections");
  return NextResponse.json({ row: updated });
}
