import Link from "next/link";

// Phase 3 replaces this with the real kiosk (name grid → PIN → photo → clock
// in/out). For now it's the front door with a manager login link in the corner.
export default function KioskPlaceholder() {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-neutral-900 px-6 text-white">
      <div className="text-center">
        <div className="text-4xl font-semibold tracking-tight">The Royal Chilli</div>
        <p className="mt-3 text-neutral-400">Attendance kiosk — coming in Phase 3</p>
      </div>
      <Link
        href="/login"
        className="fixed bottom-4 left-4 text-xs text-neutral-500 hover:text-neutral-300"
      >
        Manager login
      </Link>
    </main>
  );
}
