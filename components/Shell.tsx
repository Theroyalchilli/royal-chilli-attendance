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

  const active = (href: string) => pathname === href || (href !== "/admin" && href !== "/me" && pathname.startsWith(href));

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh bg-neutral-50 md:flex">
      {/* Sidebar */}
      <aside
        className={`${navOpen ? "flex" : "hidden"} w-full shrink-0 flex-col bg-brand-dark text-white md:flex md:w-60`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-lg">📋</span>
          <span className="font-semibold tracking-tight">Staff Attendance</span>
        </div>

        <nav className="flex-1 px-3">
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

        {/* bottom: identity + (managers only) personal view + sign out */}
        <div className="border-t border-white/10 px-3 py-3">
          <div className="px-3 pb-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-white/50">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          {user.role !== "employee" && (
            <Link
              href="/me"
              onClick={() => setNavOpen(false)}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active("/me") ? "bg-white/15 font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-5 text-center">🙋</span>
              My rota &amp; pay
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <span className="w-5 text-center">↩</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
          <button
            className="grid h-9 w-9 place-items-center text-lg text-neutral-500 md:hidden"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Menu"
          >
            ☰
          </button>
          <span className="hidden text-sm font-medium text-neutral-400 md:block">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <NotificationBell />
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
