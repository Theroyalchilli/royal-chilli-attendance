import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditFoodSafetyConfig } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase.from("fs_temp_type").select("*").order("display_order");
  return NextResponse.json({ temp_types: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { label, unit, kind, limit_value, rule_text, display_order } = await req.json().catch(() => ({}));
  if (!String(label ?? "").trim() || !["max", "min"].includes(kind) || typeof limit_value !== "number") {
    return NextResponse.json({ error: "label, kind (max/min) and a numeric limit_value are required" }, { status: 400 });
  }

  const { error } = await supabase.from("fs_temp_type").insert({
    label: String(label).trim(),
    unit: unit || "°C",
    kind,
    limit_value,
    rule_text: rule_text || null,
    display_order: display_order ?? 0,
  });
  if (error) return NextResponse.json({ error: "Failed to create temp check" }, { status: 500 });

  return NextResponse.json({ success: true });
}
