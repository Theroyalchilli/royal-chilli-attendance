import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { requireManager } from "@/lib/guard";
import { signedPhotoUrl } from "@/lib/photo";

// GET ?leg=in|out → { url } signed for 5 minutes, or 404 if there's no photo.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(req);
  if ("res" in g) return g.res;
  const id = Number((await params).id);
  const leg = new URL(req.url).searchParams.get("leg") === "out" ? "out" : "in";

  const { data } = await supabase
    .from("attendance")
    .select("clock_in_photo, clock_out_photo")
    .eq("id", id)
    .maybeSingle();
  const path = leg === "out" ? data?.clock_out_photo : data?.clock_in_photo;
  if (!path) return NextResponse.json({ error: "No photo" }, { status: 404 });

  const url = await signedPhotoUrl(path);
  if (!url) return NextResponse.json({ error: "Could not sign" }, { status: 500 });
  return NextResponse.json({ url });
}
