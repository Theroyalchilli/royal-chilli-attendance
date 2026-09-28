"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { kindOf, splitNotification, type NotifGroup } from "@/lib/notification-kinds";

// The 🔔 in the top bar: a count of unread notifications, and a panel that
// slides up from the bottom on a phone (a side panel on a computer) with
// filters, Today / Yesterday / Earlier, an icon per kind, and manager
// messages readable in full. Other parts of the app (the dashboard banner)
// fire "rc-notifications-changed" so the count stays in step.

type Notif = {
  id: number;
  type: string;
  title: string | null;
  message: string;
  message_id: number | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const NOTIFS_CHANGED = "rc-notifications-changed";

type FilterKey = "all" | "unread" | NotifGroup;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "message", label: "Messages" },
  { key: "shift", label: "Shifts" },
  { key: "request", label: "Requests" },
];

const ukDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
function dayGroup(iso: string): string {
  const today = ukDay(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const d = ukDay(new Date(iso));
  return d === today ? "Today" : d === ukDay(y) ? "Yesterday" : "Earlier";
}
function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" });
}
const fullWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export async function markNotificationsRead(body: { id: number } | { all: true } | { delete: number }) {
  await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  window.dispatchEvent(new Event(NOTIFS_CHANGED));
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  // Opened from a phone alert (?nid=): mark that one read, and open a
  // manager message in full.
  const [pendingNid, setPendingNid] = useState<number | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const nid = Number(url.searchParams.get("nid"));
    if (!nid) return;
    url.searchParams.delete("nid");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    markNotificationsRead({ id: nid });
    setPendingNid(nid);
  }, []);
  const [reading, setReading] = useState<Notif | null>(null);
  // The panel renders into <body>, not inside the top bar — the bar restyles
  // its buttons (white icons on the red phone header) and could trap a
  // fixed-position child.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    window.addEventListener(NOTIFS_CHANGED, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(NOTIFS_CHANGED, load);
    };
  }, [load]);

  // Escape closes; the page behind doesn't scroll while the panel is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (reading) setReading(null);
      else setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, reading]);

  useEffect(() => {
    if (!pendingNid) return;
    const n = items.find((x) => x.id === pendingNid);
    if (!n) return;
    setPendingNid(null);
    if (n.type === "staff_message") {
      setReading({ ...n, read_at: n.read_at ?? new Date().toISOString() });
      setOpen(true);
    }
  }, [items, pendingNid]);

  const unread = items.filter((n) => !n.read_at).length;
  const shown = useMemo(
    () => items.filter((n) => (filter === "all" ? true : filter === "unread" ? !n.read_at : kindOf(n.type).group === filter)),
    [items, filter],
  );

  function markRead(n: Notif) {
    if (n.read_at) return;
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    markNotificationsRead({ id: n.id });
  }
  function remove(n: Notif) {
    setItems((list) => list.filter((x) => x.id !== n.id));
    markNotificationsRead({ delete: n.id });
  }

  function openItem(n: Notif) {
    if (!n.read_at) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markNotificationsRead({ id: n.id });
    }
    if (n.type === "staff_message" || !n.link) {
      setReading(n); // read it in full here
      return;
    }
    setOpen(false);
    // a link into another app (e.g. the POS Staff Hub) isn't a route this app's router knows
    if (n.link.startsWith("http")) window.location.href = n.link;
    else router.push(n.link);
  }

  function markAll() {
    setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    markNotificationsRead({ all: true });
  }

  const groups: { label: string; items: Notif[] }[] = [];
  for (const n of shown) {
    const label = dayGroup(n.created_at);
    if (groups[groups.length - 1]?.label === label) groups[groups.length - 1].items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setReading(null);
          load();
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-brand px-1 text-[11px] font-bold leading-none text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {mounted && createPortal(<>
      {/* backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* panel: bottom sheet on a phone, side panel on a computer */}
      <div
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!open}
        className={`fixed inset-x-0 bottom-0 z-[61] flex h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[420px] sm:rounded-none ${
          open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
      >
        {reading ? (
          <MessageView n={reading} onBack={() => setReading(null)} onClose={() => setOpen(false)} />
        ) : (
          <>
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-neutral-300 sm:hidden" />
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-extrabold">Notifications</h2>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={markAll} className="rounded-lg px-2 py-1 text-sm font-semibold text-brand hover:bg-brand/5">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-neutral-200/70 text-neutral-600" aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                    filter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white text-neutral-500"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-2.5 pb-6">
              {groups.length === 0 ? (
                <p className="px-4 py-16 text-center text-sm text-neutral-400">{filter === "unread" ? "You're all caught up ✓" : "Nothing here yet."}</p>
              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <p className="px-2 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400">{g.label}</p>
                    {g.items.map((n) => {
                      const k = kindOf(n.type);
                      const { title, body } = splitNotification(n);
                      return (
                        <SwipeRow key={n.id} unread={!n.read_at} onOpen={() => openItem(n)} onRead={() => markRead(n)} onDelete={() => remove(n)}>
                          <span className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${k.tint}`}>{k.icon}</span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                              {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                              <span className="truncate">{title}</span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-sm text-neutral-600">{body}</span>
                          </span>
                          <span className="pt-0.5 text-xs text-neutral-400">{ago(n.created_at)}</span>
                        </SwipeRow>
                      );
                    })}
                  </div>
                ))
              )}
              <a
                href="/me/notifications/history"
                onClick={() => setOpen(false)}
                className="mt-4 block rounded-xl py-3 text-center text-sm font-semibold text-brand hover:bg-brand/5"
              >
                See all history (30 days) →
              </a>
            </div>
          </>
        )}
      </div>
      </>, document.body)}
    </>
  );
}

function MessageView({ n, onBack, onClose }: { n: Notif; onBack: () => void; onClose: () => void }) {
  const k = kindOf(n.type);
  const { title, body } = splitNotification(n);
  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-3 py-3">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">
          ← Notifications
        </button>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-neutral-200/70 text-neutral-600" aria-label="Close">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">
          {k.icon} {n.type === "staff_message" ? "From the manager" : k.title}
        </p>
        <h3 className="mt-2 text-2xl font-bold leading-snug text-ink">{title}</h3>
        <p className="mt-1 text-xs text-neutral-400">{fullWhen(n.created_at)}</p>
        <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-neutral-700">{body}</p>
      </div>
    </>
  );
}

// One notification row. On a phone: swipe right to mark read, swipe left to
// delete. On a computer: ✓ and 🗑 buttons appear on hover.
const SWIPE = 80;
function SwipeRow({
  unread,
  onOpen,
  onRead,
  onDelete,
  children,
}: {
  unread: boolean;
  onOpen: () => void;
  onRead: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    setStart({ x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start) return;
    const x = e.clientX - start.x;
    const y = e.clientY - start.y;
    if (!dragging && Math.abs(y) > Math.abs(x)) return setStart(null); // scrolling the list
    if (Math.abs(x) > 8) setDragging(true);
    if (dragging) setDx(Math.max(-140, Math.min(unread ? 140 : 0, x)));
  };
  const end = () => {
    if (dragging) {
      if (dx <= -SWIPE) onDelete();
      else if (dx >= SWIPE) onRead();
    }
    setDx(0);
    setStart(null);
    setTimeout(() => setDragging(false), 0);
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl">
      {/* what the swipe reveals */}
      <div className="absolute inset-0 flex items-center justify-between px-5 text-sm font-semibold text-white">
        <span className={`rounded-lg px-2 py-1 ${dx > 0 ? "bg-emerald-600" : "opacity-0"}`}>✓ Read</span>
        <span className={`rounded-lg px-2 py-1 ${dx < 0 ? "bg-red-600" : "opacity-0"}`}>Delete 🗑</span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        className={`relative ${dragging ? "" : "transition-transform duration-200"} ${unread ? "bg-[#FCEDEA]" : "bg-cream"}`}
      >
        <button
          onClick={() => !dragging && onOpen()}
          className="grid w-full grid-cols-[40px_1fr_auto] items-start gap-3 px-2.5 py-2.5 text-left transition-colors hover:bg-neutral-100/80"
        >
          {children}
        </button>
        {/* computer: quick actions on hover */}
        <span className="absolute bottom-2 right-2 hidden gap-1 sm:group-hover:flex">
          {unread && (
            <button onClick={onRead} title="Mark as read" className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm shadow-sm hover:bg-emerald-50">
              ✓
            </button>
          )}
          <button onClick={onDelete} title="Delete" className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm shadow-sm hover:bg-red-50">
            🗑
          </button>
        </span>
      </div>
    </div>
  );
}
