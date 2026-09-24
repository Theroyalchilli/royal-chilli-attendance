import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewTrace } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

// Reads the POS's own supplier register (shared Supabase project) rather
// than keeping a second, separate list — only the two food-safety-specific
// columns (approved, docs_status) are new here.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewTrace(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, phone, approved, docs_status, active")
    .eq("active", 1)
    .order("name");

  return NextResponse.json({ suppliers: data ?? [] });
}
