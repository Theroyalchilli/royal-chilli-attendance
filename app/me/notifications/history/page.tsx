"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { kindOf, splitNotification } from "@/lib/notification-kinds";

// My account → Notifications → History: everything from the last 30 days
// (older ones are cleared daily), including ones swiped away from the bell.
// Search, filter by kind and by period; 30 at a time.

type Notif = {
  id: number;
  type: string;
  title: string | null;
  message: string;
  link: string | null;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

const GROUPS = [
  { key: "", label: "All" },
  { key: "message", label: "Messages" },
  { key: "shift", label: "Shifts" },
  { key: "request", label: "Requests" },
];
const RANGES = [
  { key: "all", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "week", label: "This week" },
];

const month = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export default function NotificationHistoryPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [range, setRange] = useState("all");
  const [items, setItems] = useState<Notif[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  const fetchPage = useCallback(
    async (before?: string) => {
      const p = new URLSearchParams({ range });
      if (q.trim()) p.set("q", q.trim());
      if (group) p.set("group", group);
      if (before) p.set("before", before);
      const res = await fetch(`/api/notifications/history?${p}`, { cache: "no-store" });
      return res.ok ? ((await res.json()) as { items: Notif[]; more: boolean }) : { items: [], more: false };
    },
    [q, group, range],
  );

  // reload when the filters change (search waits for typing to pause)
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      const d = await fetchPage();
      setItems(d.items);
      setMore(d.more);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    const d = await fetchPage(last.created_at);
    setItems((list) => [...list, ...d.items]);
    setMore(d.more);
  }

  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-neutral-500"}`;

  let lastMonth = "";
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/me/notifications" className="text-sm text-neutral-500 hover:underline">← Notifications</Link>
      <h1 className="mt-1 text-2xl font-bold">Notification history</h1>
      <p className="mt-1 text-sm text-neutral-500">Everything from the last 30 days, including ones you swiped away.</p>

      <input
        id="history-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        className="mt-4 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
      />
      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {GROUPS.map((g) => (
          <button key={g.key || "all"} onClick={() => setGroup(g.key)} className={chip(group === g.key)}>{g.label}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)} className={chip(range === r.key)}>{r.label}</button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">{q ? "Nothing matches that search." : "No notifications in this period."}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {items.map((n) => {
              const k = kindOf(n.type);
              const { title, body } = splitNotification(n);
              const m = month(n.created_at);
              const header = m !== lastMonth ? m : null;
              lastMonth = m;
              const expanded = open === n.id;
              return (
                <div key={n.id}>
                  {header && <p className="bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">{header}</p>}
                  <button
                    onClick={() => setOpen(expanded ? null : n.id)}
                    className={`grid w-full grid-cols-[36px_1fr] gap-3 border-t border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50 ${n.deleted_at ? "opacity-60" : ""}`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${k.tint}`}>{k.icon}</span>
                    <span className="min-w-0">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold text-ink">{title}</span>
                        <span className="shrink-0 text-xs text-neutral-400">{when(n.created_at)}</span>
                      </span>
                      <span className={`mt-0.5 block text-sm text-neutral-600 ${expanded ? "whitespace-pre-line" : "line-clamp-2"}`}>{body}</span>
                      {n.deleted_at && <span className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">Removed from bell</span>}
                      {expanded && n.link && !n.link.startsWith("http") && (
                        <Link href={n.link} className="mt-2 inline-block text-sm font-semibold text-brand">Open →</Link>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {more && !loading && (
          <button onClick={loadMore} className="mt-3 w-full rounded-xl border border-neutral-300 bg-white py-2.5 text-sm font-semibold hover:bg-neutral-50">
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
