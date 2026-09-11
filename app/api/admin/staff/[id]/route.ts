import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";
import { audit } from "@/lib/attendance-write";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageAttendance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const staffId = Number((await params).id);
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  for (const [key, coerce] of [
    ["rota_start", (v: unknown) => (v ? String(v) : null)],
    ["rota_end", (v: unknown) => (v ? String(v) : null)],
    ["rota_break_minutes", (v: unknown) => (v == null ? null : Math.max(0, Number(v)))],
    ["rota_grace_minutes", (v: unknown) => (v == null ? null : Math.max(0, Number(v)))],
  ] as const) {
    if (key in body) patch[key] = coerce(body[key]);
  }
  if ("rota_working_days" in body && Array.isArray(body.rota_working_days)) {
    patch.rota_working_days = body.rota_working_days
      .map(Number)
      .filter((n: number) => n >= 1 && n <= 7);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("staff").update(patch).eq("id", staffId);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await audit(session.id, "staff_attendance_update", staffId, null, patch);
  return NextResponse.json({ success: true });
}
