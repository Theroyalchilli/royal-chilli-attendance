import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditTrace } from "@/lib/food-safety-permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditTrace(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { approved, docs_status } = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (typeof approved === "boolean") update.approved = approved;
  if (docs_status !== undefined) update.docs_status = docs_status || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabase.from("suppliers").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });

  return NextResponse.json({ success: true });
}
