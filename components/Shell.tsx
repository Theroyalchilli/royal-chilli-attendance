"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";
import type { SessionUser } from "@/lib/types";

export type NavItem = { href: string; label: string; icon: string };

const ROLE_LABEL: Record<string, string> = { employee: "Employee", manager: "Manager", hr: "HR", admin: "Admin" };

export default function Shell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const active = (href: string) => pathname === href || (href !== "/admin" && href !== "/me" && pathname.startsWith(href));

  return (
    <div className="min-h-dvh bg-neutral-50 md:flex">
      {/* Sidebar */}
      <aside
        className={`${navOpen ? "block" : "hidden"} w-full shrink-0 bg-brand-dark text-white md:block md:w-60`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-lg">📋</span>
          <span className="font-semibold tracking-tight">Staff Attendance</span>
        </div>
        <nav className="px-3 pb-4">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setNavOpen(false)}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active(n.href) ? "bg-white/15 font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-5 text-center">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
          <button className="text-neutral-500 md:hidden" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">
            ☰
          </button>
          <div className="hidden flex-1 sm:block">
            <input
              placeholder="Search employees…"
              className="w-full max-w-md rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand"
              >
                {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                  <div className="border-b border-neutral-100 px-3 py-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-neutral-400">{ROLE_LABEL[user.role] ?? user.role}</p>
                  </div>
                  <Link href="/me" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm hover:bg-neutral-50">
                    My account
                  </Link>
                  <button
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" });
                      router.replace("/login");
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
