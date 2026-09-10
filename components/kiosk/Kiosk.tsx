"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCamera } from "./useCamera";
import * as queue from "@/lib/kiosk-queue";

type StaffTile = { id: number; name: string; onShift: boolean };
type Screen =
  | { k: "grid" }
  | { k: "pin"; staff: StaffTile }
  | { k: "working"; staff: StaffTile }
  | { k: "done"; action: "in" | "out"; name: string; time: string; queued?: boolean }
  | { k: "error"; message: string };

const RESET_MS = 4500;

function uuid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function Kiosk() {
  const [screen, setScreen] = useState<Screen>({ k: "grid" });
  const [staff, setStaff] = useState<StaffTile[]>([]);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const camera = useCamera();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/kiosk/staff", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.staff)) setStaff(data.staff);
    } catch {
      /* offline — keep the last list */
    }
  }, []);

  // staff list refresh + queue drain loop
  useEffect(() => {
    loadStaff();
    queue.count().then(setPending);
    const tick = setInterval(async () => {
      if (screen.k === "grid") loadStaff();
      if (navigator.onLine) {
        const { left } = await queue.drain();
        setPending(left);
        if (left === 0) loadStaff();
      }
    }, 20_000);
    const goOnline = () => {
      setOnline(true);
      queue.drain().then(({ left }) => {
        setPending(left);
        loadStaff();
      });
    };
    const goOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [loadStaff, screen.k]);

  const backToGrid = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setSearch("");
    setScreen({ k: "grid" });
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(backToGrid, RESET_MS);
  }, [backToGrid]);

  async function submitPin(staffTile: StaffTile, pin: string) {
    setScreen({ k: "working", staff: staffTile });
    const client_uuid = uuid();
    const photo = await camera.capture();

    try {
      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffTile.id, pin, photo, client_uuid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScreen({ k: "error", message: data.error || "Something went wrong" });
        scheduleReset();
        return;
      }
      setScreen({ k: "done", action: data.action, name: data.name, time: data.time });
      loadStaff();
      scheduleReset();
    } catch {
      // network failure — queue it
      await queue.enqueue({
        client_uuid,
        staff_id: staffTile.id,
        staff_name: staffTile.name,
        pin,
        photo,
        queued_at: new Date().toISOString(),
      });
      setPending(await queue.count());
      setScreen({
        k: "done",
        action: staffTile.onShift ? "out" : "in",
        name: staffTile.name,
        time: new Date().toISOString(),
        queued: true,
      });
      scheduleReset();
    }
  }

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="no-select relative min-h-dvh bg-neutral-950 text-white">
      {camera.videoEl}

      {/* status strip */}
      <div className="absolute right-3 top-3 flex items-center gap-3 text-xs text-neutral-500">
        {!online && <span className="rounded bg-amber-500/20 px-2 py-1 text-amber-300">Offline</span>}
        {pending > 0 && <span>{pending} to sync</span>}
        {!camera.ready && camera.tried && <span className="text-neutral-600">no camera</span>}
      </div>

      {screen.k === "grid" && (
        <div className="mx-auto max-w-4xl px-6 py-10">
          <h1 className="text-center text-2xl font-semibold tracking-tight">Tap your name to clock in / out</h1>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="mx-auto mt-6 block w-full max-w-sm rounded-xl bg-white/10 px-4 py-3 text-center text-lg outline-none placeholder:text-neutral-500"
          />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setScreen({ k: "pin", staff: s })}
                className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 py-6 transition active:scale-95 hover:bg-white/10"
              >
                <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white/10 text-lg font-bold">
                  {initials(s.name)}
                  {s.onShift && (
                    <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-neutral-950 bg-emerald-400" />
                  )}
                </span>
                <span className="px-2 text-center text-sm font-medium leading-tight">{s.name}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="mt-10 text-center text-sm text-neutral-500">No matching staff.</p>
          )}
          <div className="mt-10 space-y-1 text-center text-[11px] leading-relaxed text-neutral-600">
            <p>This tablet photographs you at clock-in and clock-out for attendance verification. Photos are kept 60 days.</p>
            <p>Ask a manager for a copy or deletion of your data.</p>
          </div>
          <Link href="/login" className="fixed bottom-3 left-3 text-xs text-neutral-700 hover:text-neutral-400">
            Staff login
          </Link>
        </div>
      )}

      {screen.k === "pin" && (
        <PinScreen staff={screen.staff} onCancel={backToGrid} onSubmit={(pin) => submitPin(screen.staff, pin)} />
      )}

      {screen.k === "working" && (
        <Centered>
          <div className="text-5xl">📸</div>
          <p className="mt-4 text-lg text-neutral-300">Hold still, {screen.staff.name.split(" ")[0]}…</p>
        </Centered>
      )}

      {screen.k === "done" && (
        <button onClick={backToGrid} className="block h-dvh w-full">
          <Centered>
            <div className="text-6xl">{screen.action === "in" ? "✅" : "👋"}</div>
            <p className="mt-4 text-2xl font-semibold">
              {screen.name.split(" ")[0]} — clocked {screen.action === "in" ? "in" : "out"}
            </p>
            <p className="mt-1 text-lg text-emerald-300">{fmtTime(screen.time)}</p>
            {screen.queued && (
              <p className="mt-3 text-sm text-amber-300">Saved — will sync when the connection is back</p>
            )}
          </Centered>
        </button>
      )}

      {screen.k === "error" && (
        <button onClick={backToGrid} className="block h-dvh w-full">
          <Centered>
            <div className="text-6xl">⚠️</div>
            <p className="mt-4 max-w-sm text-center text-lg text-neutral-200">{screen.message}</p>
            <p className="mt-2 text-sm text-neutral-500">Tap to go back</p>
          </Centered>
        </button>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-6 text-center">{children}</div>;
}

function PinScreen({
  staff,
  onCancel,
  onSubmit,
}: {
  staff: StaffTile;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (pin.length === 4) {
      const p = pin;
      setPin("");
      onSubmit(p);
    }
  }, [pin, onSubmit]);

  // auto-cancel back to the grid if someone walks away mid-entry
  useEffect(() => {
    const t = setTimeout(onCancel, 20_000);
    return () => clearTimeout(t);
  }, [onCancel, pin]);

  return (
    <Centered>
      <p className="text-xl text-neutral-400">Hi {staff.name.split(" ")[0]}</p>
      <p className="mt-1 text-sm text-neutral-500">Enter your 4-digit PIN</p>
      <div className="mt-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-white" : "bg-white/20"}`}
          />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
          d === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => setPin((p) => (d === "⌫" ? p.slice(0, -1) : (p + d).slice(0, 4)))}
              className="h-16 w-16 rounded-full bg-white/10 text-2xl font-medium transition active:scale-90 hover:bg-white/20"
            >
              {d}
            </button>
          ),
        )}
      </div>
      <button onClick={onCancel} className="mt-8 text-sm text-neutral-500 hover:text-neutral-300">
        Cancel
      </button>
    </Centered>
  );
}
