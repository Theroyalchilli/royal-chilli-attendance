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
const VALID_ROLES = new Set<SessionUser["role"]>(["employee", "manager", "hr", "admin"]);

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(JWT_SECRET);
}

// A staff session token carries no `type`/`purpose` marker of its own, and
// this app shares JWT_SECRET with the POS, which also mints a 30-day
// customer_session token and a password-reset token under that same secret.
// Without validating shape here, either of those would verify successfully
// and get treated as a logged-in staff member by any route that only checks
// "is there a session" rather than also checking role. Requiring `role` to
// be a real staff role — which those other token types never set — closes
// that gap.
async function verify(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    const { id, name, role } = payload;
    if (typeof id !== "number" || typeof name !== "string" || !VALID_ROLES.has(role as SessionUser["role"])) {
      return null;
    }
    return { id, name, role: role as SessionUser["role"] };
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
      // Set COOKIE_DOMAIN=.royalchilli.com in BOTH apps once they're on the
      // subdomains — then a manager login in either signs them into the other.
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    },
  };
}
