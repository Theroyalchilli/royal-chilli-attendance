import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditFoodSafetyConfig } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

// Config lists everything, active and retired — Tasks only ever reads the
// active ones (see /api/me/food-safety), so retiring a check here doesn't
// touch its history, just stops it appearing on future shifts.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase.from("fs_check_type").select("*").order("check_window").order("display_order");
  return NextResponse.json({ check_types: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { check_window, label, rule_text, requires_photo, display_order } = await req.json().catch(() => ({}));
  if (!check_window || !String(label ?? "").trim()) {
    return NextResponse.json({ error: "check_window and label are required" }, { status: 400 });
  }
  if (!["opening", "service", "closing", "weekly"].includes(check_window)) {
    return NextResponse.json({ error: "Invalid check_window" }, { status: 400 });
  }

  const { error } = await supabase.from("fs_check_type").insert({
    check_window,
    label: String(label).trim(),
    rule_text: rule_text || null,
    requires_photo: !!requires_photo,
    display_order: display_order ?? 0,
  });
  if (error) return NextResponse.json({ error: "Failed to create check" }, { status: 500 });

  return NextResponse.json({ success: true });
}
