import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditFoodSafetyConfig } from "@/lib/food-safety-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase.from("fs_course").select("*").order("name");
  return NextResponse.json({ courses: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditFoodSafetyConfig(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, refresh_months, has_level } = await req.json().catch(() => ({}));
  if (!String(name ?? "").trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { error } = await supabase.from("fs_course").insert({
    name: String(name).trim(),
    refresh_months: refresh_months ?? 0,
    has_level: !!has_level,
  });
  if (error) return NextResponse.json({ error: "Failed to create course" }, { status: 500 });

  return NextResponse.json({ success: true });
}
