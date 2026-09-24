"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

// Only the first 4 items get a direct slot — everything after that collapses
// into the 5th "More" slot's sheet, grouped by `group` where items share one
// (e.g. Food Safety's Tasks/Allergens/My Training), with ungrouped items
// (Payslips) listed bare underneath.
const DIRECT_COUNT = 4;

export default function BottomNav({ items }: { items: NavItem[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const active = (href: string) => (href === "/me" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  const direct = items.slice(0, DIRECT_COUNT);
  const overflow = items.slice(DIRECT_COUNT);
  const moreActive = overflow.some((n) => active(n.href));

  const groups: { label: string | null; items: NavItem[] }[] = [];
  for (const item of overflow) {
    const label = item.group ?? null;
    let g = groups.find((g) => g.label === label);
    if (!g) { g = { label, items: [] }; groups.push(g); }
    g.items.push(item);
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        <div className="grid grid-cols-5">
          {direct.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(n.href) ? "text-brand" : "text-neutral-400"}`}
            >
              <span className="text-lg">{n.icon}</span>
              {n.label}
            </Link>
          ))}
          {overflow.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${moreActive ? "text-brand" : "text-neutral-400"}`}
            >
              <span className="text-lg">⋯</span>
              More
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-xl">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-neutral-200" />
            <div className="px-2 pb-2 pt-3">
              {groups.map((g, gi) => (
                <div key={g.label ?? `_${gi}`} className="mb-1 last:mb-0">
                  {g.label && (
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{g.label}</p>
                  )}
                  {g.items.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active(n.href) ? "text-brand" : "text-neutral-700"}`}
                    >
                      <span className="text-lg">{n.icon}</span>
                      {n.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
