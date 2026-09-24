import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "royal-chilli-pos-fallback-secret-key-2024"
);

// Consumes a one-time login handoff token minted by the POS's Staff Hub
// ("Attendance & Rota" sidebar link) so a manager/HR/admin already signed
// into the POS lands here already logged in — no separate login screen.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.purpose !== "sso") throw new Error("not an sso handoff token");

    const user: SessionUser = {
      id: payload.id as number,
      name: payload.name as string,
      role: payload.role as SessionUser["role"],
    };
    const sessionToken = await createSession(user);
    const { name: cookieName, options } = getSessionCookieOptions();

    const response = NextResponse.redirect(new URL("/admin", req.url));
    response.cookies.set(cookieName, sessionToken, options);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
