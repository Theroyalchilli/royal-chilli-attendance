import { NextRequest, NextResponse } from "next/server";
import { phonesOn, recipientsFor, type Audience } from "@/lib/staff-messages";
import { requireSender } from "../guard";

export const dynamic = "force-dynamic";

// GET ?audience=&ids=1,2 — "Goes to 9 people · 6 have phone alerts on"
export async function GET(req: NextRequest) {
  const g = await requireSender(req);
  if ("res" in g) return g.res;
  const sp = new URL(req.url).searchParams;
  const audience = (sp.get("audience") || "everyone") as Audience;
  const ids = (sp.get("ids") || "").split(",").map(Number).filter(Boolean);
  const people = await recipientsFor(audience, ids);
  return NextResponse.json({ people: people.length, phones: await phonesOn(people) });
}
