// Shown the moment a menu link is tapped, so the old page doesn't just sit
// there while the new one loads (and lets Next prefetch these pages).
export default function Loading() {
  return <p className="text-sm text-neutral-400">Loading…</p>;
}
