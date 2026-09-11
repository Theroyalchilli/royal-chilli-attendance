"use client";

import { useCallback, useEffect, useState } from "react";
import { captureSelfie, getPosition } from "@/lib/selfie";
import { hm } from "@/lib/format";

type Status = { clocked_in: boolean; since: string | null; geofence: boolean };
type Phase = "idle" | "locating" | "capturing" | "sending" | "done" | "error";

export default function ClockButton() {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/punch", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function punch() {
    setPhase("locating");
    setMsg("");
    const pos = status?.geofence ? await getPosition() : null;

    setPhase("capturing");
    const photo = await captureSelfie();

    setPhase("sending");
    try {
      const res = await fetch("/api/me/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, lat: pos?.lat, lng: pos?.lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setMsg(data.error || "Something went wrong");
        return;
      }
      setPhase("done");
      setMsg(data.action === "in" ? `Clocked in at ${new Date(data.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : `Clocked out — ${hm(data.net_work_seconds)} today`);
      load();
      setTimeout(() => setPhase("idle"), 4000);
    } catch {
      setPhase("error");
      setMsg("No connection — try again");
    }
  }

  if (!status) {
    return <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />;
  }

  const busy = phase === "locating" || phase === "capturing" || phase === "sending";
  const busyLabel = phase === "locating" ? "Checking location…" : phase === "capturing" ? "📸 Hold still…" : "Saving…";
  const clockedIn = status.clocked_in;

  return (
    <div>
      <button
        onClick={punch}
        disabled={busy}
        className={`flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-6 text-lg font-bold text-white transition disabled:opacity-70 ${
          clockedIn ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {busy ? busyLabel : clockedIn ? "Clock Out" : "Clock In"}
      </button>

      {phase === "done" && <p className="mt-2 text-center text-sm font-medium text-emerald-600">{msg}</p>}
      {phase === "error" && <p className="mt-2 text-center text-sm text-red-600">{msg}</p>}
      {phase === "idle" && clockedIn && status.since && (
        <p className="mt-2 text-center text-sm text-neutral-500">
          Clocked in since {new Date(status.since).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      {phase === "idle" && status.geofence && (
        <p className="mt-2 text-center text-xs text-neutral-400">Must be at the restaurant. A photo is taken.</p>
      )}
    </div>
  );
}
