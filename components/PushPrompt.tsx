"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { phoneState, turnPhoneOn, type PhoneState } from "@/lib/push-client";

// Dashboard card for people who haven't turned phone alerts on yet. Once
// they have, it disappears — the switches live in My account → Notifications.
const DISMISS_KEY = "rc-push-dismissed-at";

export default function PushPrompt() {
  const [state, setState] = useState<PhoneState | "hidden" | "busy" | "just-on">("hidden");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (Date.now() - dismissed < 7 * 24 * 3600 * 1000) return;
      } catch {
        /* storage blocked — just show the card */
      }
      const s = await phoneState();
      if (s === "off" || s === "blocked" || s === "add-to-home") setState(s);
    })().catch(() => {});
  }, []);

  async function turnOn() {
    setState("busy");
    setError("");
    try {
      const s = await turnPhoneOn();
      setState(s === "on" ? "just-on" : s);
    } catch {
      setError("Couldn't turn notifications on — try again");
      setState("off");
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

  if (state === "hidden" || state === "on" || state === "unsupported" || state === "not-configured") return null;

  const box = "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-neutral-800";
  if (state === "just-on") {
    return (
      <div className={`${box} border-emerald-200 bg-emerald-50 text-emerald-800`}>
        <b>🔔 Notifications are on.</b> Choose what buzzes your phone in{" "}
        <Link href="/me/notifications" className="underline">My account → Notifications</Link>.
      </div>
    );
  }
  if (state === "add-to-home") {
    return (
      <div className={box}>
        <p className="font-semibold">🔔 Get shift reminders on your iPhone</p>
        <p className="mt-1 text-neutral-600">
          Add this app to your Home Screen first: tap <b>Share</b> then <b>Add to Home Screen</b>. Open it from there and turn notifications on.
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
