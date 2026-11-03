import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { businessForHost, getBusiness } from "@/lib/business";

// The business's logo at one same-site address, for the loading, offline,
// no-access, not-found and error pages (components/StatusPage.tsx). Signed-in
// staff get the business they're working in; anyone else the address's.
// Served from here so the service worker can keep a copy for the offline page.
//
// Only a business's OWN logo: no logo uploaded yet → 404 and the pages show
// none (never another business's). The owner switches business on the same
// address, so the phone must check back each time (no-cache + ETag → a quick
// "not changed" when it's the same business).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req).catch(() => null);
  const b = session ? await getBusiness(session.businessId).catch(() => null) : await businessForHost(req.headers.get("host")).catch(() => null);
  if (!b?.logo_url) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

  const etag = `"${b.id}-${hash(b.logo_url)}"`;
  const headers = { "Cache-Control": "private, no-cache", ETag: etag };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const r = await fetch(new URL(b.logo_url, req.nextUrl.origin)).catch(() => null);
  if (!r?.ok) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(r.body, { headers: { ...headers, "Content-Type": r.headers.get("Content-Type") || "image/png" } });
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
