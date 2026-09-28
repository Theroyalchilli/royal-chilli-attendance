"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { reloadOnceForStaleVersion } from "@/lib/chunk-error";

// Any page that crashes lands here instead of the bare "Application error"
// text. A page open from before a new version went live reloads itself once.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname() || "/";
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error("[page error]", error);
    if (reloadOnceForStaleVersion(error)) setReloading(true);
  }, [error]);

  if (reloading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-neutral-500">Updating to the latest version…</div>;
  }

  // "home" = the start of their own area
  const home = pathname.startsWith("/admin") ? "/admin" : pathname.startsWith("/me") ? "/me" : "/";
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-sm place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Something went wrong 🌶️</h1>
        <p className="mt-2 text-sm text-neutral-500">We&apos;re sorry — this page couldn&apos;t be loaded properly.</p>
        <p className="mt-2 text-sm text-neutral-500">Please try again. If the problem continues, return to the homepage and try again in a moment.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Try Again
          </button>
          <a href={home} className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold">Back to Home</a>
        </div>
        <p className="mt-6 text-xs text-neutral-500">If you still need help, please contact The Royal Chilli team.</p>
        <p className="mt-1 text-xs text-neutral-500">Authentic Flavours. Memorable Experiences.</p>
        {error.digest && <p className="mt-3 text-[11px] text-neutral-400">Error ref: {error.digest}</p>}
      </div>
    </div>
  );
}
