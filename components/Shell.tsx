"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";
import BottomNav from "./BottomNav";
import ChangePasswordModal from "./ChangePasswordModal";
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const isEmployee = user.role === "employee";

  useEffect(() => {
    setDrawerOpen(false);
    setProfileOpen(false);
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
            {group.items.map((n) => {
              const itemClassName = `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active(n.href) ? "bg-white/15 font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`;
              // /api/sso/staffhub redirects into a different app (the POS) —
              // it isn't a page this app's router can render, so Link's
              // client-side navigation (which fetches it as an RSC payload)
              // intermittently throws. A plain <a> forces a real browser
              // navigation instead, same fix already applied in
              // NotificationBell for the same kind of cross-app link.
              if (n.href.startsWith("/api/")) {
                return (
                  <a key={n.href} href={n.href} className={itemClassName}>
                    <span className="w-5 text-center">{n.icon}</span>
                    {n.label}
                  </a>
                );
              }
              return (
                <Link key={n.href} href={n.href} className={itemClassName}>
                  <span className="w-5 text-center">{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
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

      {/* Mobile drawer + backdrop — managers/hr/admin only; employees get BottomNav instead */}
      {!isEmployee && drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-dark text-white shadow-xl">
            {sidebarBody(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`flex items-center justify-between px-4 py-3 print:hidden ${
            isEmployee
              ? "sticky top-0 z-20 bg-brand text-white shadow-sm md:static md:border-b md:border-neutral-200 md:bg-white md:text-inherit md:shadow-none"
              : "border-b border-neutral-200 bg-white"
          }`}
        >
          {isEmployee ? (
            <span className="flex items-center gap-2.5 md:hidden">
              <Image src="/logo.png" alt="" width={32} height={32} className="rounded-lg object-cover" />
              <span className="min-w-0">
                <span className="block font-[family-name:var(--font-playfair)] text-base font-bold leading-tight">The Royal Chilli</span>
                <span className="block text-[11px] leading-tight text-white/70">Kingsley Road · Hounslow</span>
              </span>
            </span>
          ) : (
            <button
              className="grid h-9 w-9 place-items-center text-lg text-neutral-500 md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
          <span className="hidden text-sm font-medium text-neutral-400 md:block">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <span className="flex items-center gap-3">
            <span className={isEmployee ? "[&_button]:text-white [&_button:hover]:bg-white/15 md:[&_button]:text-neutral-500 md:[&_button:hover]:bg-neutral-100" : ""}>
              <NotificationBell />
            </span>
            {isEmployee && (
              <span className="relative md:hidden">
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-brand-dark text-sm font-semibold text-white"
                  aria-label="Account"
                >
                  {user.name.charAt(0).toUpperCase()}
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                      <div className="px-2 py-1.5">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-neutral-400">{ROLE_LABEL[user.role] ?? user.role}</p>
                      </div>
                      <button
                        onClick={() => { setProfileOpen(false); setPasswordOpen(true); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-100"
                      >
                        🔒 Change password
                      </button>
                      <button
                        onClick={signOut}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-100"
                      >
                        ↩ Sign out
                      </button>
                    </div>
                  </>
                )}
              </span>
            )}
          </span>
        </header>

        <main className={`flex-1 p-4 sm:p-6 ${isEmployee ? "pb-24 md:pb-6" : ""}`}>{children}</main>

        {isEmployee && <BottomNav items={nav[0]?.items ?? []} />}
      </div>

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}
