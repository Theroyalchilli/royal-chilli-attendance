import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canLogFoodSafety } from "@/lib/food-safety-permissions";

// Pass/fail is computed server-side from the temp_type's own rule — never
// trust a client-sent pass flag for something this safety-critical. A fail
// forces a corrective-action note before it can be saved.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canLogFoodSafety(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { temp_type_id, value, corrective_action } = await req.json().catch(() => ({}));
  if (!temp_type_id || typeof value !== "number") {
    return NextResponse.json({ error: "temp_type_id and a numeric value are required" }, { status: 400 });
  }

  const { data: tempType } = await supabase.from("fs_temp_type").select("kind, limit_value").eq("id", temp_type_id).single();
  if (!tempType) return NextResponse.json({ error: "Unknown temp type" }, { status: 404 });

  const pass = tempType.kind === "max" ? value <= Number(tempType.limit_value) : value >= Number(tempType.limit_value);
  if (!pass && !String(corrective_action ?? "").trim()) {
    return NextResponse.json({ error: "A corrective action is required when a reading fails" }, { status: 400 });
  }

  const { error } = await supabase.from("fs_temp_log").insert({
    temp_type_id,
    staff_id: session.id,
    value,
    pass,
    corrective_action: pass ? null : String(corrective_action).trim(),
  });
  if (error) return NextResponse.json({ error: "Failed to log temperature" }, { status: 500 });

  return NextResponse.json({ success: true, pass });
}
