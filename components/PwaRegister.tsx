"use client";

import { useEffect } from "react";

// Registers public/sw.js on every page (not only when phone notifications are
// turned on), so the offline page is saved before the phone loses signal.
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
