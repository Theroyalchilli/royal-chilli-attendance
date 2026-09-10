import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "./auth";
import { canManageAttendance } from "./permissions";
import type { SessionUser } from "./types";

/** Returns the session for a manager, or a 401 NextResponse to return early. */
export async function requireManager(
  req: NextRequest,
): Promise<{ session: SessionUser } | { res: NextResponse }> {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageAttendance(session.role)) {
    return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}
