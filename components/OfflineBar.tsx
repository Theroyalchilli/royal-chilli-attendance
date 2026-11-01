"use client";

import { useEffect, useState } from "react";

// A red bar across the top while the phone/computer has no internet, so a
// page that stops updating says why. Goes away by itself when it's back.
export default function OfflineBar() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!offline) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[300] bg-[#B42318] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-[13px] font-semibold text-white shadow print:hidden">
      📶 No internet — check Wi-Fi or mobile data. Changes can&apos;t be saved until you&apos;re back online.
    </div>
  );
}
