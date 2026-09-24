import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditFoodSafetyConfig } from "@/lib/food-safety-permissions";

// Edits the template only — never touches any fs_check_log row already
// logged against it. "Delete" is deliberately not offered here: set
// active=false to retire a check instead (see 057's comment on fs_course
// for the same reasoning — history references this row).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { check_window, label, rule_text, requires_photo, active, display_order } = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (check_window !== undefined) update.check_window = check_window;
  if (label !== undefined) update.label = String(label).trim();
  if (rule_text !== undefined) update.rule_text = rule_text || null;
  if (requires_photo !== undefined) update.requires_photo = !!requires_photo;
  if (active !== undefined) update.active = !!active;
  if (display_order !== undefined) update.display_order = display_order;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabase.from("fs_check_type").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update check" }, { status: 500 });

  return NextResponse.json({ success: true });
}
