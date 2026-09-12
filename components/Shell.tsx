"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";
import type { SessionUser } from "@/lib/types";
import type { NavGroup } from "@/lib/nav";

const ROLE_LABEL: Record<string, string> = { employee: "Employee", manager: "Manager", hr: "HR", admin: "Admin" };

export default function Shell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // exact match for the two "home" routes, prefix match for the rest
  const active = (href: string) =>
    href === "/admin" || href === "/me" ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const sidebarBody = (onClose?: () => void) => (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-lg">📋</span>
        <span className="font-semibold tracking-tight">Staff Attendance</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-white/70 hover:text-white" aria-label="Close menu">
            ✕
          </button>
        )}
      </div>

      <nav className="px-3">
        {nav.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : ""}>
            {group.label && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">{group.label}</p>
            )}
            {group.items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active(n.href) ? "bg-white/15 font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="w-5 text-center">{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-white/10 px-3 py-3">
        <div className="px-3 pb-2">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-white/50">{ROLE_LABEL[user.role] ?? user.role}</p>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <span className="w-5 text-center">↩</span>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-cream md:flex">
      {/* Desktop sidebar — sticky; never printed */}
      <aside className="hidden w-60 shrink-0 self-start bg-brand-dark text-white md:sticky md:top-0 md:block md:h-dvh print:hidden">
        {sidebarBody()}
      </aside>

      {/* Mobile drawer + backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-dark text-white shadow-xl">
            {sidebarBody(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 print:hidden">
          <button
            className="grid h-9 w-9 place-items-center text-lg text-neutral-500 md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
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
