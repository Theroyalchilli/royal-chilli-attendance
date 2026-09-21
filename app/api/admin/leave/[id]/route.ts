import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { audit } from "@/lib/attendance-write";
import { notify } from "@/lib/notify";

// PATCH { action: "approve" | "reject", review_note? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);
  const { action } = await req.json();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Bad action" }, { status: 400 });
  }

  const { data: leave } = await supabase.from("leave_requests").select("*").eq("id", id).maybeSingle();
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (leave.status !== "pending") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  const status = action === "approve" ? "approved" : "rejected";
  const { data: updated, error } = await supabase
    .from("leave_requests")
    .update({ status, decided_by: g.session.id, decided_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  await audit(g.session.id, `leave_${status}`, id, leave, updated);
  await notify(
    leave.staff_id,
    "leave_reviewed",
    `Your ${leave.leave_type} leave request (${leave.start_date} to ${leave.end_date}) was ${status}.`,
    "/me/leave",
  );
  return NextResponse.json({ row: updated });
}
