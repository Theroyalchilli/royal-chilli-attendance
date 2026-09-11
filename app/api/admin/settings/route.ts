import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { clearSettingsCache } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Attendance app settings — admin only. Currently just the geofence for phone
// clock-in. Reuses the shared app_settings keys.
const KEYS = ["geofence_enabled", "restaurant_latitude", "restaurant_longitude", "geofence_radius_meters"];

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase.from("app_settings").select("key, value").in("key", KEYS);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return NextResponse.json({
    geofence_enabled: m.geofence_enabled === true || m.geofence_enabled === "true",
    restaurant_latitude: m.restaurant_latitude != null ? Number(m.restaurant_latitude) : null,
    restaurant_longitude: m.restaurant_longitude != null ? Number(m.restaurant_longitude) : null,
    geofence_radius_meters: m.geofence_radius_meters != null ? Number(m.geofence_radius_meters) : 150,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json();
  const rows: { key: string; value: unknown; updated_at: string }[] = [];
  const now = new Date().toISOString();
  const set = (key: string, value: unknown) => rows.push({ key, value, updated_at: now });

  if ("geofence_enabled" in b) set("geofence_enabled", !!b.geofence_enabled);
  if ("restaurant_latitude" in b) set("restaurant_latitude", b.restaurant_latitude == null ? null : Number(b.restaurant_latitude));
  if ("restaurant_longitude" in b) set("restaurant_longitude", b.restaurant_longitude == null ? null : Number(b.restaurant_longitude));
  if ("geofence_radius_meters" in b) set("geofence_radius_meters", Math.max(20, Math.round(Number(b.geofence_radius_meters) || 150)));

  if (rows.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Save failed" }, { status: 500 });
  clearSettingsCache();
  return NextResponse.json({ success: true });
}
