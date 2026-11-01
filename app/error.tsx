"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { reloadOnceForStaleVersion } from "@/lib/chunk-error";
import StatusPage from "@/components/StatusPage";

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
    <StatusPage
      icon="⚠️"
      title="Something went wrong"
      lines={["Sorry, this page couldn't be loaded properly.", "Please try again. If it keeps happening, go back to the start and try again in a moment."]}
      actions={[
        { label: "Try again", onClick: () => { reset(); window.location.reload(); }, primary: true },
        { label: "Back to start", href: home },
      ]}
      note="If you still need help, please ask your manager."
      digest={error.digest}
    />
  );
}
