import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Same `staff.password_hash` column royal-chilli-pos logs in against, so a
// password changed here works there too (and vice versa).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (!current_password || !new_password) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }
  if (String(new_password).length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, password_hash")
    .eq("id", session.id)
    .single();
  if (error || !staff?.password_hash) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(current_password, staff.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const password_hash = await bcrypt.hash(new_password, 10);
  const { error: updateErr } = await supabase.from("staff").update({ password_hash }).eq("id", session.id);
  if (updateErr) return NextResponse.json({ error: "Failed to update password" }, { status: 500 });

  return NextResponse.json({ success: true });
}
