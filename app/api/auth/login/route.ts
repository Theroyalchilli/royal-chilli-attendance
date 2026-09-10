import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";
import type { StaffRole } from "@/lib/types";

// Same credentials as royal-chilli-pos: verifies username + password against the
// shared `staff` table (same bcrypt hash). Only roles that can manage staff in
// the POS get a session here — employees use the kiosk, not this login.
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

    if (!canManageAttendance(data.role as StaffRole)) {
      return NextResponse.json({ error: "This login isn't for the attendance console" }, { status: 403 });
    }

    const token = await createSession({ id: data.id, name: data.name, role: data.role as StaffRole });
    const { name: cookieName, options } = getSessionCookieOptions();

    const res = NextResponse.json({ success: true, user: { id: data.id, name: data.name, role: data.role } });
    res.cookies.set(cookieName, token, options);
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
