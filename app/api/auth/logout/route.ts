import { NextResponse } from "next/server";
import { getSessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const { name, options } = getSessionCookieOptions();
  const res = NextResponse.json({ success: true });
  res.cookies.set(name, "", { ...options, maxAge: 0 });
  return res;
}
