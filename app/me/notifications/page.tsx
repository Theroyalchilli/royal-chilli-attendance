"use client";

import { useEffect, useState } from "react";
import { phoneState, sendTest, turnPhoneOff, turnPhoneOn, type PhoneState } from "@/lib/push-client";

// My account → Notifications: phone alerts on/off for this phone, and which
// alerts buzz it. Manager messages and shift reminders are always on.
// Everything still lands in the 🔔 bell.

type Prefs = { rota: boolean; requests: boolean; team_late: boolean; team_requests: boolean };
type Device = { endpoint: string; user_agent: string | null; created_at: string };

const deviceName = (ua: string | null) =>
  !ua ? "Phone" : /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android phone" : /Windows|Macintosh/i.test(ua) ? "Computer" : "Phone";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function Switch({ id, on, onChange, disabled }: { id: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-emerald-600" : "bg-neutral-300"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Row({ icon, title, hint, children }: { icon: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="text-lg leading-6">{icon}</span>
        <div className="min-w-0">
          <p className="font-medium text-ink">{title}</p>
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

const Locked = () => <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">Always on 🔒</span>;

export default function NotificationSettingsPage() {
  const [phone, setPhone] = useState<PhoneState | "checking" | "busy">("checking");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [note, setNote] = useState("");

  const loadPrefs = () =>
    fetch("/api/me/notification-prefs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setPrefs(d.prefs);
        setDevices(d.devices ?? []);
        setIsManager(!!d.isManager);
      })
      .catch(() => {});

  useEffect(() => {
    loadPrefs();
    phoneState().then(setPhone).catch(() => setPhone("unsupported"));
  }, []);

  async function togglePhone(on: boolean) {
    setNote("");
    setPhone("busy");
    try {
      const s = on ? await turnPhoneOn() : await turnPhoneOff();
      setPhone(s);
      if (on && s === "on") setNote("Done — a test notification is on its way.");
    } catch {
      setPhone(on ? "off" : "on");
      setNote("Couldn't change that — try again.");
    }
    loadPrefs();
  }

  async function test() {
    setNote("");
    setNote((await sendTest()) ? "Test sent — check your phone." : "Turn phone alerts on first.");
  }

  async function setPref(key: keyof Prefs, value: boolean) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
    const res = await fetch("/api/me/notification-prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) {
      setPrefs({ ...prefs });
      setNote("Couldn't save that — try again.");
    }
  }

  const phoneOn = phone === "on";
  const card = "overflow-hidden rounded-2xl border border-neutral-200 bg-white";
  const label = "mb-2 mt-6 px-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="mt-1 text-sm text-neutral-500">Choose what buzzes your phone. Everything still appears in the 🔔 bell.</p>

      <p className={label}>This phone</p>
      <div className={card}>
        {phone === "add-to-home" ? (
          <div className="px-4 py-4 text-sm">
            <p className="font-semibold">🔔 Phone alerts on your iPhone</p>
            <p className="mt-1 text-neutral-600">
              Add this app to your Home Screen first: tap <b>Share</b> then <b>Add to Home Screen</b>. Open it from there and come back here.
            </p>
          </div>
        ) : phone === "unsupported" || phone === "not-configured" ? (
          <p className="px-4 py-4 text-sm text-neutral-500">Phone alerts aren&apos;t available in this browser. Open the app on your phone to turn them on.</p>
        ) : (
          <>
            <Row
              icon="🔔"
              title="Phone alerts"
              hint={
                phone === "checking"
                  ? "Checking…"
                  : phone === "blocked"
                    ? "Blocked in your phone's Settings — allow notifications for this app there"
                    : phoneOn
                      ? `On for this ${deviceName(typeof navigator !== "undefined" ? navigator.userAgent : null)}`
                      : "Off for this phone"
              }
            >
              <Switch id="phone-alerts" on={phoneOn} onChange={togglePhone} disabled={phone === "checking" || phone === "busy" || phone === "blocked"} />
            </Row>
            {phoneOn && (
              <div className="px-4 pb-3">
                <button onClick={test} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50">
                  Send me a test
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {devices.length > 1 && (
        <p className="mt-2 px-1 text-xs text-neutral-500">
          Alerts are on for {devices.length} devices: {devices.map((d) => `${deviceName(d.user_agent)} (${day(d.created_at)})`).join(", ")}.
        </p>
      )}
      {note && <p className="mt-2 px-1 text-sm font-medium text-emerald-700">{note}</p>}

      <p className={label}>What buzzes my phone</p>
      <div className={card}>
        <Row icon="📣" title="Messages from the manager"><Locked /></Row>
        <Row icon="⏰" title="Shift reminders" hint="15 min before · not clocked in · forgot to clock out"><Locked /></Row>
        <Row icon="📅" title="Rota ready & shift changes">
          <Switch id="pref-rota" on={prefs?.rota ?? true} onChange={(v) => setPref("rota", v)} disabled={!prefs} />
        </Row>
        <Row icon="🌴" title="My leave & corrections" hint="When they're approved or declined">
          <Switch id="pref-requests" on={prefs?.requests ?? true} onChange={(v) => setPref("requests", v)} disabled={!prefs} />
        </Row>
      </div>

      {isManager && (
        <>
          <p className={label}>Managers</p>
          <div className={card}>
            <Row icon="🚨" title="Staff not clocked in" hint="And forgotten clock-outs">
              <Switch id="pref-team-late" on={prefs?.team_late ?? true} onChange={(v) => setPref("team_late", v)} disabled={!prefs} />
            </Row>
            <Row icon="📝" title="New leave & correction requests">
              <Switch id="pref-team-requests" on={prefs?.team_requests ?? true} onChange={(v) => setPref("team_requests", v)} disabled={!prefs} />
            </Row>
          </div>
        </>
      )}

      <p className="mt-6 rounded-xl bg-neutral-100 px-4 py-3 text-xs text-neutral-600">
        🌙 Between 1am and 8am, rota and request alerts wait quietly in the bell. Shift reminders and manager messages still come through.
      </p>
    </div>
  );
}
