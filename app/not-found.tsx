import type { Metadata } from "next";
import Link from "next/link";

// Any address that doesn't exist: same look as the "something went wrong"
// page (app/error.tsx), with a way back to the start.
export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-sm place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Page not found 🌶️</h1>
        <p className="mt-2 text-sm text-neutral-500">This page doesn&apos;t exist, or the link is out of date.</p>
        <p className="mt-2 text-sm text-neutral-500">Go back to the start and try again from there.</p>
        <div className="mt-5 grid grid-cols-1 gap-2">
          <Link href="/" className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark">Back to Home</Link>
        </div>
        <p className="mt-6 text-xs text-neutral-500">If you still need help, please ask your manager.</p>
      </div>
    </div>
  );
}
