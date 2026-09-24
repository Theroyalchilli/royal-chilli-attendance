import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getAttendanceSettings, localDateString } from "@/lib/settings";
import { canSignoffFoodSafety } from "@/lib/food-safety-permissions";

// THE core legal act this whole module exists to produce — confirms the
// day's opening/closing checks were done and safe methods followed. One per
// day (fs_signoff.day is UNIQUE), so a second attempt is refused with a
// clear message rather than a raw constraint error.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: staffRow } = await supabase.from("staff").select("can_signoff").eq("id", session.id).single();
  if (!canSignoffFoodSafety(session.role, staffRow?.can_signoff ?? false)) {
    return NextResponse.json({ error: "You don't have sign-off authority" }, { status: 403 });
  }

  const settings = await getAttendanceSettings();
  const today = localDateString(new Date(), settings.timezone);

  const { data: existing } = await supabase.from("fs_signoff").select("id").eq("day", today).maybeSingle();
  if (existing) return NextResponse.json({ error: "Today has already been signed off" }, { status: 409 });

  const { error } = await supabase.from("fs_signoff").insert({ day: today, staff_id: session.id });
  if (error) return NextResponse.json({ error: "Failed to sign off" }, { status: 500 });

  return NextResponse.json({ success: true });
}
