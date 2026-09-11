"use client";

import { useEffect, useState } from "react";

export default function SettingsForm() {
  const [enabled, setEnabled] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("150");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setEnabled(!!d.geofence_enabled);
        setLat(d.restaurant_latitude != null ? String(d.restaurant_latitude) : "");
        setLng(d.restaurant_longitude != null ? String(d.restaurant_longitude) : "");
        setRadius(String(d.geofence_radius_meters ?? 150));
      })
      .finally(() => setLoading(false));
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return setMsg("This device can't get a location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setLocating(false);
        setMsg("Location captured — save to apply.");
      },
      () => {
        setLocating(false);
        setMsg("Couldn't get your location.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        geofence_enabled: enabled,
        restaurant_latitude: lat ? Number(lat) : null,
        restaurant_longitude: lng ? Number(lng) : null,
        geofence_radius_meters: Number(radius) || 150,
      }),
    });
    setSaving(false);
    setMsg(res.ok ? "Saved." : "Save failed.");
  }

  if (loading) return <p className="text-sm text-neutral-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500">Location check for phone clock-in.</p>

      <div className="mt-6 space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Require staff to be at the restaurant</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5" />
        </label>
        <p className="text-xs text-neutral-400">
          When on, a phone clock-in / clock-out is rejected unless the person is within the radius below.
          The kiosk tablet is never geofenced.
        </p>

        <button
          onClick={useMyLocation}
          disabled={locating}
          className="w-full rounded-lg border border-neutral-300 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
        >
          {locating ? "Getting location…" : "📍 Use my current location (stand in the restaurant)"}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">
            Latitude
            <input value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900" />
          </label>
          <label className="text-xs text-neutral-500">
            Longitude
            <input value={lng} onChange={(e) => setLng(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900" />
          </label>
        </div>

        <label className="block text-xs text-neutral-500">
          Radius (metres)
          <input type="number" min={20} value={radius} onChange={(e) => setRadius(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900" />
          <span className="mt-1 block text-neutral-400">150m is a good default — phone GPS is less accurate indoors.</span>
        </label>

        {msg && <p className="text-sm text-neutral-600">{msg}</p>}

        <button onClick={save} disabled={saving} className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
