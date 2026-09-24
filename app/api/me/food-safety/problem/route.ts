import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canLogFoodSafety } from "@/lib/food-safety-permissions";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canLogFoodSafety(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { what, action } = await req.json().catch(() => ({}));
  if (!String(what ?? "").trim() || !String(action ?? "").trim()) {
    return NextResponse.json({ error: "What happened and what you did are both required" }, { status: 400 });
  }

  const { error } = await supabase.from("fs_problem").insert({
    what: String(what).trim(),
    action: String(action).trim(),
    staff_id: session.id,
  });
  if (error) return NextResponse.json({ error: "Failed to log problem" }, { status: 500 });

  return NextResponse.json({ success: true });
}
