import { NextRequest, NextResponse } from "next/server";
import { businessForHost } from "@/lib/business";

// Which business this sign-in page is for, from the address it was opened on
// (attendance.melthouse.co.uk -> Melt House). Branding only — signing in
// always lands a person in their own business. Unknown addresses keep the
// original Royal Chilli wording.
export async function GET(req: NextRequest) {
  const b = await businessForHost(req.headers.get("host")).catch(() => null);
  return NextResponse.json({ name: b?.name ?? "Royal Chilli", logoUrl: b?.logo_url ?? null });
}
