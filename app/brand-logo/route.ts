import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { businessForHost, getBusiness } from "@/lib/business";

// The business's logo at one same-site address, for the loading, offline,
// no-access, not-found and error pages (components/StatusPage.tsx). Signed-in
// staff get their own business's; anyone else the address's. Served from here
// so the service worker can keep a copy for the offline page. No logo → initials.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req).catch(() => null);
  const b = session ? await getBusiness(session.businessId).catch(() => null) : await businessForHost(req.headers.get("host")).catch(() => null);
  const headers = { "Cache-Control": "private, max-age=3600" };
  if (b?.logo_url) {
    const r = await fetch(new URL(b.logo_url, req.nextUrl.origin)).catch(() => null);
    if (r?.ok) return new Response(r.body, { headers: { ...headers, "Content-Type": r.headers.get("Content-Type") || "image/png" } });
  }
  const text = initials(b?.name ?? "The Royal Chilli");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#E34435"/><text x="60" y="76" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#fff" text-anchor="middle">${text}</text></svg>`;
  return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}

function initials(name: string): string {
  return name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && w.toLowerCase() !== "the").slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}
