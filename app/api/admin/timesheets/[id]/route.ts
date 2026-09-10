import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";

// Status flow: draft → submitted → approved → locked. Unlock: locked → approved.
const NEXT: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected", "draft"],
  approved: ["locked", "draft"],
  rejected: ["draft"],
  locked: ["approved"], // unlock
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);
  const { status } = await req.json();

  const { data: ts } = await supabase.from("timesheets").select("*").eq("id", id).maybeSingle();
  if (!ts) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!NEXT[ts.status]?.includes(status)) {
    return NextResponse.json({ error: `Can't move from ${ts.status} to ${status}` }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "submitted") patch.submitted_at = new Date().toISOString();
  if (status === "approved") {
    patch.approved_by = g.session.id;
    patch.approved_at = new Date().toISOString();
    patch.locked = false;
  }
  if (status === "locked") patch.locked = true;
  if (status === "draft" || status === "rejected") patch.locked = false;

  const { error } = await supabase.from("timesheets").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await audit(g.session.id, `timesheet_${status}`, id, { status: ts.status }, { status });
  return NextResponse.json({ success: true });
}
