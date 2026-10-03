import { NextRequest, NextResponse } from "next/server";
import { createSession, getSessionCookieOptions, getSessionFromRequest } from "@/lib/auth";
import { getBusiness } from "@/lib/business";
import { bizDb } from "@/lib/business-db";

// POST { businessId } — the group owner steps into another business (same as
// the Staff Hub's switcher in royal-chilli-pos). Only the owner can; everyone
// else works for their own business only.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.owner) return NextResponse.json({ error: "Only the owner can switch business" }, { status: 403 });

  const { businessId } = await req.json().catch(() => ({}));
  const business = await getBusiness(Number(businessId));
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { name, options } = getSessionCookieOptions(req.headers.get("host"));
  const res = NextResponse.json({ business: { id: business.id, name: business.name } });
  res.cookies.set(name, await createSession({ ...session, businessId: business.id }), options);

  await bizDb(business.id).from("audit_logs").insert({
    staff_id: session.id, action: "owner_switched_business", entity_type: "business", entity_id: business.id,
    changes: { from: session.businessId, to: business.id, app: "attendance" },
  });
  return res;
}
