import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res, req.headers.get("host"));
  return res;
}
