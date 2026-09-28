"use client";

import { useEffect, useState } from "react";

// "Turn on notifications" card for staff and managers. Android: works in the
// browser or the Home Screen app. iPhone: only once the app is added to the
// Home Screen (iOS 16.4+), so there it explains that step first.

type State = "hidden" | "ask" | "add-to-home" | "blocked" | "busy" | "on";
const DISMISS_KEY = "rc-push-dismissed-at";

function base64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function PushPrompt() {
  const [state, setState] = useState<State>("hidden");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (Date.now() - dismissed < 7 * 24 * 3600 * 1000) return;
      } catch {
        /* storage blocked — just show the card */
      }
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (isIos() && !isStandalone()) setState("add-to-home");
        return;
      }
      const res = await fetch("/api/push", { cache: "no-store" }).catch(() => null);
      const info = res && res.ok ? await res.json() : null;
      if (!info?.enabled || !info.publicKey) return; // not set up on the server yet
      setKey(info.publicKey);

      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      if (existing && Notification.permission === "granted") {
        // make sure the server still has this phone (e.g. after a reinstall)
        await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: existing }) }).catch(() => {});
        return; // already on — no card
      }
      setState(Notification.permission === "denied" ? "blocked" : "ask");
    })().catch(() => {});
  }, []);

  async function turnOn() {
    setState("busy");
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "ask");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) as BufferSource }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, test: true }),
      });
      if (!res.ok) throw new Error("save failed");
      setState("on");
    } catch {
      setError("Couldn't turn notifications on — try again");
      setState("ask");
    }
  }

  function notNow() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setState("hidden");
  }

  if (state === "hidden") return null;

  const box = "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-neutral-800";
  if (state === "on") {
    return <div className={`${box} border-emerald-200 bg-emerald-50 font-semibold text-emerald-800`}>🔔 Notifications are on — you&apos;ll get shift reminders here.</div>;
  }
  if (state === "add-to-home") {
    return (
      <div className={box}>
        <p className="font-semibold">🔔 Get shift reminders on your iPhone</p>
        <p className="mt-1 text-neutral-600">
          Add this app to your Home Screen first: tap <b>Share</b> <span aria-hidden>⎋</span> then <b>Add to Home Screen</b>. Open it from there and turn notifications on.
        </p>
        <button onClick={notNow} className="mt-2 text-xs text-neutral-500 underline">Not now</button>
      </div>
    );
  }
  if (state === "blocked") {
    return (
      <div className={box}>
        <p className="font-semibold">🔕 Notifications are blocked</p>
        <p className="mt-1 text-neutral-600">To get shift reminders, allow notifications for this app in your phone&apos;s Settings, then reopen it.</p>
        <button onClick={notNow} className="mt-2 text-xs text-neutral-500 underline">Not now</button>
      </div>
    );
  }
  return (
    <div className={box}>
      <p className="font-semibold">🔔 Get alerts for your rota and shifts</p>
      <p className="mt-1 text-neutral-600">A reminder before each shift, if you forget to clock in or out, and when your rota changes.</p>
      {error && <p className="mt-1 text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={turnOn} disabled={state === "busy"} className="flex-1 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {state === "busy" ? "Turning on…" : "Turn on notifications"}
        </button>
        <button onClick={notNow} className="rounded-xl px-3 py-2.5 text-neutral-500">Not now</button>
      </div>
    </div>
  );
}
