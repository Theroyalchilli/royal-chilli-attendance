"use client";

import { useEffect } from "react";
import { onAuthChange } from "@/lib/auth-sync";

// Keeps every open tab on the account that's actually signed in:
// - another tab signed in, out or switched business → reload this one;
// - coming back to a tab → check who's signed in now, and reload if it
//   changed (also catches a change made in the POS / Staff Hub, which shares
//   the sign-in across subdomains where tabs can't message each other);
// - a page brought back by the Back button from the browser's memory
//   (back/forward cache) → reload it, so a signed-out account's page can't
//   reappear.

async function whoIsSignedIn(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (res.status === 401) return "none";
    if (!res.ok) return null; // can't tell — leave the page alone
    const { user } = await res.json();
    return user ? `${user.id}:${user.businessId}` : "none";
  } catch {
    return null;
  }
}

export default function AuthSync() {
  useEffect(() => {
    const stop = onAuthChange(() => window.location.reload());

    const onShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onShow);

    const checks = !/^\/login(\/|$)/.test(window.location.pathname);
    let signedIn: string | null = null;
    if (checks) whoIsSignedIn().then((who) => { signedIn = who; });
    const onVisible = async () => {
      if (!checks || document.visibilityState !== "visible" || signedIn === null) return;
      const now = await whoIsSignedIn();
      if (now !== null && now !== signedIn) window.location.reload();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stop();
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
