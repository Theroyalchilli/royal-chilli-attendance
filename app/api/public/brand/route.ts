import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { businessForHost, getBusiness } from "@/lib/business";

// GET — the business's name, for the pages that can't look it up themselves
// (offline page, error page). Signed-in staff: their business; else the address's.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req).catch(() => null);
  const b = session ? await getBusiness(session.businessId).catch(() => null) : await businessForHost(req.headers.get("host")).catch(() => null);
  return NextResponse.json({ name: b?.name ?? "The Royal Chilli" }, { headers: { "Cache-Control": "private, no-cache" } });
}
