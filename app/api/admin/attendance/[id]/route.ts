import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { recomputeAndSave } from "@/lib/recompute-row";
import { audit } from "@/lib/attendance-write";

// PATCH — edit a row's raw punches / break override / adjustment / note.
// Never a silent rewrite: the change goes to audit_logs and everything is
// recomputed through the time engine.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);
  const body = await req.json();

  const { data: before } = await supabase.from("attendance").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if ("clock_in" in body) patch.clock_in = body.clock_in ? new Date(body.clock_in).toISOString() : null;
  if ("clock_out" in body) patch.clock_out = body.clock_out ? new Date(body.clock_out).toISOString() : null;
  if ("break_override_minutes" in body)
    patch.break_override_minutes = body.break_override_minutes == null ? null : Math.max(0, Number(body.break_override_minutes));
  if ("adjustment_seconds" in body) patch.adjustment_seconds = Math.round(Number(body.adjustment_seconds) || 0);
  if ("notes" in body) patch.notes = body.notes || null;
  if ("approval_status" in body && ["approved", "rejected", "pending"].includes(body.approval_status)) {
    patch.approval_status = body.approval_status;
    patch.approved_by = body.approval_status === "approved" ? g.session.id : null;
    patch.approved_at = body.approval_status === "approved" ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  if (patch.clock_in && patch.clock_out && new Date(patch.clock_out as string) <= new Date(patch.clock_in as string)) {
    return NextResponse.json({ error: "Clock-out must be after clock-in" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from("attendance").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  const updated = await recomputeAndSave(id);
  await audit(g.session.id, "attendance_edit", id, before, updated);
  return NextResponse.json({ row: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);
  const { data: before } = await supabase.from("attendance").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("attendance").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  await audit(g.session.id, "attendance_delete", id, before, null);
  return NextResponse.json({ success: true });
}
