import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

/** Messages can be sent by managers and admins (owner's choice, 2026-09-28). */
export async function requireSender(req: NextRequest): Promise<{ session: SessionUser } | { res: NextResponse }> {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== "manager" && session.role !== "admin")) {
    return { res: NextResponse.json({ error: "Only managers and admins can send messages" }, { status: 401 }) };
  }
  return { session };
}
