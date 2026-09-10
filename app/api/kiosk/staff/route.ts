import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Unauthenticated — this is the shared reception tablet's name grid. It exposes
// only names + on-shift state; the PIN (checked in /punch, rate-limited) is the
// gate on anything that writes.
export async function GET() {
  const [{ data: staff, error }, { data: open }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name")
      .eq("active", 1)
      .not("pin_hash", "is", null)
      .order("name"),
    supabase
      .from("attendance")
      .select("staff_id")
      .is("clock_out", null)
      .not("clock_in", "is", null),
  ]);

  if (error) {
    console.error("kiosk staff fetch error:", error);
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  }

  const onShift = new Set((open ?? []).map((o) => o.staff_id));
  return NextResponse.json({
    staff: (staff ?? []).map((s) => ({ id: s.id, name: s.name, onShift: onShift.has(s.id) })),
  });
}
