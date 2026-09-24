import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditFoodSafetyConfig } from "@/lib/food-safety-permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { label, unit, kind, limit_value, rule_text, active, display_order } = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (label !== undefined) update.label = String(label).trim();
  if (unit !== undefined) update.unit = unit;
  if (kind !== undefined) update.kind = kind;
  if (limit_value !== undefined) update.limit_value = limit_value;
  if (rule_text !== undefined) update.rule_text = rule_text || null;
  if (active !== undefined) update.active = !!active;
  if (display_order !== undefined) update.display_order = display_order;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabase.from("fs_temp_type").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update temp check" }, { status: 500 });

  return NextResponse.json({ success: true });
}
