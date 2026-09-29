import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import type { StaffRole } from "@/lib/types";
import { loginBusinessId, staffHome } from "@/lib/business";

// Same credentials as royal-chilli-pos: verifies username + password against the
// shared `staff` table (same bcrypt hash). Everyone logs in — employees land on
// their personal dashboard, managers/hr/admin on the team console.
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, role, password_hash, active")
      .eq("username", String(username).trim().toLowerCase())
      .eq("active", 1)
      .single();

    if (error || !data || !data.password_hash) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const businessId = await loginBusinessId(data.id);
    if (businessId == null) {
      return NextResponse.json({ error: "Your account isn't set up at any business yet — ask a manager." }, { status: 403 });
    }
    const owner = (await staffHome(data.id)).isOwner;
    const token = await createSession({ id: data.id, name: data.name, role: data.role as StaffRole, businessId, ...(owner ? { owner: true } : {}) });
    const { name: cookieName, options } = getSessionCookieOptions();

    const res = NextResponse.json({ success: true, user: { id: data.id, name: data.name, role: data.role } });
    res.cookies.set(cookieName, token, options);
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
