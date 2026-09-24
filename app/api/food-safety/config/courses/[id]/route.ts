import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditFoodSafetyConfig } from "@/lib/food-safety-permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, refresh_months, has_level, active } = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = String(name).trim();
  if (refresh_months !== undefined) update.refresh_months = refresh_months;
  if (has_level !== undefined) update.has_level = !!has_level;
  if (active !== undefined) update.active = !!active;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabase.from("fs_course").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update course" }, { status: 500 });

  return NextResponse.json({ success: true });
}
