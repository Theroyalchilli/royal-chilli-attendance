import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageAttendance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, name, role, employment_type, pay_rate, pin_hash, rota_start, rota_end, rota_working_days, rota_break_minutes, rota_grace_minutes",
    )
    .eq("active", 1)
    .order("name");
  if (error) return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });

  return NextResponse.json({
    staff: (data ?? []).map((s) => {
      const { pin_hash, ...rest } = s as typeof s & { pin_hash: string | null };
      return { ...rest, has_pin: !!pin_hash };
    }),
  });
}
