import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Admin, then HR, then Manager, then Employee.
const ROLE_ORDER: Record<string, number> = { admin: 0, hr: 1, manager: 2, employee: 3 };

// GET ?q=&role=&active= — search by name/employee number, filter by role,
// filter by active (1 = active [default], 0 = inactive, "all" = both).
export async function GET(req: NextRequest) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const role = searchParams.get("role")?.trim() ?? "";
  const active = searchParams.get("active") ?? "1";

  let query = supabase
    .from("staff")
    .select("id, name, role, employee_number, employment_type, pay_rate, active")
    .order("name");
  if (active !== "all") query = query.eq("active", active === "0" ? 0 : 1);
  if (role) query = query.eq("role", role);
  if (q) query = query.or(`name.ilike.%${q}%,employee_number.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });

  const sorted = (data ?? []).sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.name.localeCompare(b.name),
  );
  return NextResponse.json({ employees: sorted });
}
