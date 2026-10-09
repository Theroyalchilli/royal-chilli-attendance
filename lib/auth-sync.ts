// Signing in, out or switching business must leave nothing of the previous
// account on screen. A soft (client-side) navigation keeps the router cache
// and every component's state, so the old account's pages could still show
// until refreshed. Instead: full page load here, and tell the other open tabs
// (components/AuthSync.tsx) to reload too. Same as the POS's lib/auth-sync.ts.

const CHANNEL = "rc-auth";
const STORAGE_KEY = "rc-auth-change"; // fallback for browsers without BroadcastChannel

export function announceAuthChange() {
  const msg = { area: "staff", at: Date.now() };
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(msg);
    ch.close();
  } catch {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msg)); } catch { /* private mode */ }
  }
}

/** After sign-in / sign-out / switching business: tell other tabs, then load `dest` fresh. */
export function freshStart(dest: string) {
  announceAuthChange();
  window.location.replace(dest);
}

/** Listen for another tab's sign-in / sign-out. Returns a cleanup function. */
export function onAuthChange(handler: () => void): () => void {
  let ch: BroadcastChannel | null = null;
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY && e.newValue) handler(); };
  try {
    ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = () => handler();
  } catch {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    ch?.close();
    window.removeEventListener("storage", onStorage);
  };
}
