import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewTrace, canEditTrace } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

// Most recent 50 delivery checks — recall-readiness in practice means "can
// we quickly see what came in from whom, and was it accepted."
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewTrace(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase
    .from("fs_delivery_check")
    .select("id, item, temp_value, accepted, corrective_action, created_at, supplier:suppliers(name), staff:staff(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ deliveries: data ?? [], can_log: canEditTrace(session.role) });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditTrace(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { supplier_id, item, temp_value, accepted, corrective_action, purchase_order_id } = await req.json().catch(() => ({}));
  if (!supplier_id || !String(item ?? "").trim() || typeof accepted !== "boolean") {
    return NextResponse.json({ error: "supplier_id, item and accepted are required" }, { status: 400 });
  }
  if (!accepted && !String(corrective_action ?? "").trim()) {
    return NextResponse.json({ error: "A corrective action is required when a delivery is refused" }, { status: 400 });
  }

  const { error } = await supabase.from("fs_delivery_check").insert({
    supplier_id,
    purchase_order_id: purchase_order_id || null,
    item: String(item).trim(),
    temp_value: typeof temp_value === "number" ? temp_value : null,
    accepted,
    corrective_action: accepted ? null : String(corrective_action).trim(),
    staff_id: session.id,
  });
  if (error) return NextResponse.json({ error: "Failed to log delivery" }, { status: 500 });

  return NextResponse.json({ success: true });
}
