import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";

export const dynamic = "force-dynamic";

// GET ?q= — active staff only, optionally filtered by name/employee number.
export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  let query = supabase
    .from("staff")
    .select("id, name, role, employee_number, employment_type, pay_rate")
    .eq("active", 1)
    .order("name");
  if (q) query = query.or(`name.ilike.%${q}%,employee_number.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
  return NextResponse.json({ employees: data ?? [] });
}
