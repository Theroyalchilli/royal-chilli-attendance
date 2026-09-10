import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { SessionUser } from "./types";

// Same secret + payload shape + cookie name as royal-chilli-pos, so once both
// apps live on *.royalchilli.com (with the cookie domain set to .royalchilli.com)
// a manager who logs into either one is signed into the other. During the
// *.vercel.app phase the cookie is per-origin, so each app logs in on its own.
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "royal-chilli-pos-fallback-secret-key-2024"
);

const COOKIE_NAME = "pos_session";

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(JWT_SECRET);
}

async function verify(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as number,
      name: payload.name as string,
      role: payload.role as SessionUser["role"],
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return verify(store.get(COOKIE_NAME)?.value);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  return verify(req.cookies.get(COOKIE_NAME)?.value);
}

export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 12,
      path: "/",
      // Phase 8: set domain: ".royalchilli.com" here and in royal-chilli-pos
      // to share the session across the subdomains.
    },
  };
}
