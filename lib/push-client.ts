// Browser side of phone notifications: is this phone set up, and turn it on
// or off. Used by the dashboard card and My account → Notifications.

export type PhoneState =
  | "unsupported"    // this browser can't do it
  | "add-to-home"    // iPhone: needs the app on the Home Screen first
  | "not-configured" // the server has no keys yet
  | "blocked"        // the person said no in the phone's settings
  | "off"
  | "on";

function base64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

let publicKey = "";

export async function phoneState(): Promise<PhoneState> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? "add-to-home" : "unsupported";
  const res = await fetch("/api/push", { cache: "no-store" }).catch(() => null);
  const info = res && res.ok ? await res.json() : null;
  if (!info?.enabled || !info.publicKey) return "not-configured";
  publicKey = info.publicKey;
  const reg = await navigator.serviceWorker.register("/sw.js");
  const sub = await reg.pushManager.getSubscription();
  if (Notification.permission === "denied") return "blocked";
  if (sub && Notification.permission === "granted") {
    // make sure the server still has this phone (e.g. after a reinstall)
    await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }) }).catch(() => {});
    return "on";
  }
  return "off";
}

/** Ask permission (must run from a tap), subscribe, save, and send a test. */
export async function turnPhoneOn(): Promise<PhoneState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  if (!publicKey) {
    const info = await fetch("/api/push", { cache: "no-store" }).then((r) => r.json());
    publicKey = info.publicKey;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) as BufferSource }));
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub, test: true }),
  });
  if (!res.ok) throw new Error("save failed");
  return "on";
}

export async function turnPhoneOff(): Promise<PhoneState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
}

export async function sendTest(): Promise<boolean> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub, test: true }),
  });
  return res.ok;
}
