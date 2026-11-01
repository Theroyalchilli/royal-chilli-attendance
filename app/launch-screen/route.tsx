import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { businessForHost } from "@/lib/business";
import { LAUNCH_SIZES } from "@/lib/launch-screens";

// The still picture an iPhone shows the moment the home-screen app is tapped
// (instead of a black screen): the business's logo and name. One per screen
// size (lib/launch-screens.ts); the business comes from the address. The
// moving loading bar comes after, from the pages' loading screens.
export async function GET(req: NextRequest) {
  const w = Number(req.nextUrl.searchParams.get("w"));
  const h = Number(req.nextUrl.searchParams.get("h"));
  if (!LAUNCH_SIZES.some((s) => s.w * s.dpr === w && s.h * s.dpr === h)) return new Response("Unknown size", { status: 400 });

  const b = await businessForHost(req.headers.get("host")).catch(() => null);
  const name = b?.name ?? "The Royal Chilli";
  const logo = b?.logo_url ? new URL(b.logo_url, req.nextUrl.origin).toString() : null;
  const u = w / 400;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#faf7f2" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={120 * u} height={120 * u} style={{ borderRadius: 24 * u, objectFit: "cover" }} alt="" />
        ) : (
          <div style={{ width: 120 * u, height: 120 * u, borderRadius: 24 * u, background: "#E34435", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50 * u, fontWeight: 700 }}>
            {name.split(/\s+/).filter((x) => x.toLowerCase() !== "the").slice(0, 2).map((x) => x[0]).join("")}
          </div>
        )}
        <div style={{ marginTop: 22 * u, fontSize: 24 * u, color: "#201b18", textAlign: "center" }}>{name}</div>
        <div style={{ marginTop: 6 * u, fontSize: 15 * u, color: "#6b625b" }}>Attendance</div>
      </div>
    ),
    { width: w, height: h, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
