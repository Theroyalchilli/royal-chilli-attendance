"use client";

import { useCallback, useEffect, useState } from "react";
import { markNotificationsRead, NOTIFS_CHANGED } from "./NotificationBell";
import { splitNotification } from "@/lib/notification-kinds";

// The newest unread manager message, at the top of the dashboard until the
// person taps "Got it" (which also marks it read in the bell).
type Notif = { id: number; type: string; title: string | null; message: string; read_at: string | null; created_at: string };

export default function ManagerMessageBanner() {
  const [msg, setMsg] = useState<Notif | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const items: Notif[] = (await res.json()).items ?? [];
      setMsg(items.find((n) => n.type === "staff_message" && !n.read_at) ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener(NOTIFS_CHANGED, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(NOTIFS_CHANGED, load);
    };
  }, [load]);

  if (!msg) return null;
  const { title, body } = splitNotification(msg);
  const gotIt = () => {
    setMsg(null);
    markNotificationsRead({ id: msg.id });
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-[0_4px_14px_rgba(227,68,53,0.12)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand">📣 From the manager</span>
        <button onClick={gotIt} className="px-1 text-lg leading-none text-neutral-400 hover:text-neutral-600" aria-label="Dismiss">
          ✕
        </button>
      </div>
      <h3 className="mt-1.5 text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{body}</p>
      <div className="mt-3 flex justify-end">
        <button onClick={gotIt} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Got it ✓
        </button>
      </div>
    </div>
  );
}
