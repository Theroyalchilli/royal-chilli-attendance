// A page that was open before a new version went live asks for script files
// that no longer exist — Next.js then crashes with "Application error: a
// client-side exception". Reloading fetches the new version and fixes it, so
// the error screens do that automatically, once. Safe in the browser only.

const KEY = "rc-chunk-reload-at";
const LOOP_GUARD_MS = 30_000;

export function isStaleVersionError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  const text = `${e?.name ?? ""} ${e?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(text);
}

/** Reload once for a stale-version error. False if we just did (so show the error screen instead of looping). */
export function reloadOnceForStaleVersion(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleVersionError(error)) return false;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < LOOP_GUARD_MS) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked — still worth one reload */
  }
  window.location.reload();
  return true;
}
