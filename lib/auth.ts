import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sessionCookieDomain } from "./app-hosts";
import type { SessionUser } from "./types";
import { DEFAULT_BUSINESS_ID } from "./business-id";

// Same secret + payload shape + cookie name as royal-chilli-pos. On a
// business's pos./staff./attendance. subdomains the cookie covers the whole
// business domain (lib/app-hosts.ts), so one sign-in works in both apps; on
// *.vercel.app it stays per-origin and each app logs in on its own.
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "royal-chilli-pos-fallback-secret-key-2024"
);

const COOKIE_NAME = "pos_session";
const VALID_ROLES = new Set<SessionUser["role"]>(["employee", "kitchen", "manager", "hr", "admin"]);

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, role: user.role, bid: user.businessId, ...(user.owner ? { own: true } : {}) })
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
    const { id, name, role, bid, own } = payload;
    if (typeof id !== "number" || typeof name !== "string" || !VALID_ROLES.has(role as SessionUser["role"])) {
      return null;
    }
    // Logins from before multi-business don't say — they're The Royal Chilli.
    const businessId = typeof bid === "number" && Number.isInteger(bid) && bid > 0 ? bid : DEFAULT_BUSINESS_ID;
    return { id, name, role: role as SessionUser["role"], businessId, ...(own === true ? { owner: true } : {}) };
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

export function getSessionCookieOptions(host?: string | null) {
  const domain = sessionCookieDomain(host);
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 12,
      path: "/",
      ...(domain ? { domain } : {}),
    },
  };
}

/**
 * Signs the person out on this address: clears the business-wide cookie and
 * any older one tied to just this host, so neither keeps them signed in.
 */
export function clearSessionCookie(res: NextResponse, host?: string | null) {
  const { name, options } = getSessionCookieOptions(host);
  res.cookies.set(name, "", { ...options, maxAge: 0 });
  if (options.domain) {
    res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${options.secure ? "; Secure" : ""}`);
  }
}
