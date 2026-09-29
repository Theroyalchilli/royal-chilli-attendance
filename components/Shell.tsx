"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";
import BottomNav from "./BottomNav";
import ChangePasswordModal from "./ChangePasswordModal";
import type { SessionUser } from "@/lib/types";
import type { NavGroup, NavItem } from "@/lib/nav";

const ROLE_LABEL: Record<string, string> = { employee: "Employee", manager: "Manager", hr: "HR", admin: "Admin" };

// Top menu bar, same look as the POS Staff Hub. On a computer each group's
// list opens when the mouse is over it (CSS, .top-mi in globals.css) or on
// click. On a phone, managers/hr/admin get 🔔 + ☰ (a drawer from the right);
// employees keep their red header and the BottomNav.
export default function Shell({
  user,
  nav,
  approvals = 0,
  children,
}: {
  user: SessionUser;
  nav: NavGroup[];
  approvals?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const isEmployee = user.role === "employee";

  useEffect(() => {
    setDrawerOpen(false);
    setProfileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpenMenu(null); setDrawerOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  // Exact match for the "home" routes; prefix match for everything else.
  const active = (href: string) =>
    href === "/admin" || href === "/me" || href === "/admin/food-safety" || href === "/me/food-safety"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
  const groupActive = (g: NavGroup) => g.items.some((i) => active(i.href));

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const toggle = (key: string) => setOpenMenu((m) => (m === key ? null : key));

  // /api/sso/staffhub redirects into a different app (the POS) — Link's
  // client-side navigation (which fetches it as an RSC payload) intermittently
  // throws, so cross-app links are a plain <a> for a real browser navigation.
  function itemLink(n: NavItem, className: string) {
    const body = (
      <>
        <span className="w-5 shrink-0 text-center">{n.icon}</span>
        <span className="min-w-0">{n.label}</span>
      </>
    );
    return n.href.startsWith("/api/") ? (
      <a key={n.href} href={n.href} className={className}>{body}</a>
    ) : (
      <Link key={n.href} href={n.href} className={className}>{body}</Link>
    );
  }

  const badge = (n: number) =>
    n > 0 ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold leading-[18px] text-white tabular-nums">{n > 99 ? "99+" : n}</span> : null;

  const topBtn = "flex items-center gap-1.5 rounded-[9px] px-[11px] py-2 text-[13.5px] font-semibold transition-colors";
  const ddPanel = "top-dd absolute right-0 top-[calc(100%+6px)] z-40 min-w-[220px] rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_30px_rgba(40,25,15,0.12)]";
  const ddLink = (on: boolean) => `flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] text-ink hover:bg-[#F6F1E6] ${on ? "bg-brand/10 font-semibold" : ""}`;
  const drawerLink = (on: boolean) => `flex items-center gap-2.5 rounded-[10px] px-2.5 py-3 text-[15px] text-ink ${on ? "bg-brand/10 font-semibold" : "hover:bg-brand/5"}`;

  const staffHub: NavItem = { href: "/api/sso/staffhub", label: "Staff Hub", icon: "🍽️" };
  const accountItems = (
    link: (on: boolean) => string,
  ) => (
    <>
      {itemLink({ href: "/me/notifications", label: "Notification settings", icon: "🔔" }, link(active("/me/notifications")))}
      <button type="button" onClick={() => { setOpenMenu(null); setDrawerOpen(false); setPasswordOpen(true); }} className={`${link(false)} w-full text-left`}>
        <span className="w-5 shrink-0 text-center">🔒</span>Change password
      </button>
      {user.role === "admin" && itemLink({ href: "/admin/settings", label: "Settings", icon: "⚙️" }, link(active("/admin/settings")))}
      <button type="button" onClick={signOut} className={`${link(false)} w-full text-left`}>
        <span className="w-5 shrink-0 text-center">↩</span>Sign out
      </button>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header ref={barRef} className={`sticky top-0 z-30 print:hidden ${isEmployee ? "bg-brand text-white shadow-sm md:bg-white md:text-ink md:shadow-none" : "bg-white"} border-b border-line`}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2.5">
          <Link href={isEmployee ? "/me" : "/admin"} className="flex min-w-0 items-center gap-2.5">
            <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
            <span className="min-w-0">
              <span className="block truncate font-[family-name:var(--font-playfair)] text-[15px] font-bold leading-tight">The Royal Chilli</span>
              {/* hidden while the menu row needs the room (md–xl) */}
              <span className={`block truncate text-[11.5px] leading-snug md:hidden xl:block ${isEmployee ? "text-white/75 md:text-neutral-500" : "text-neutral-500"}`}>
                Staff Attendance · {user.name} · {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </span>
          </Link>

          {/* Computer: the menu row */}
          <nav className="ml-auto hidden items-center gap-0.5 md:flex" aria-label="Main">
            {nav.map((g, gi) =>
              !g.label ? (
                g.items.map((n) => (
                  <Link key={n.href} href={n.href}
                    className={`${topBtn} ${active(n.href) ? "bg-brand/10 text-brand-dark" : "text-neutral-600 hover:bg-[#F6F1E6] hover:text-ink"}`}>
                    {n.label}
                  </Link>
                ))
              ) : (
                <div key={gi} className={`top-mi relative ${openMenu === g.label ? "open" : ""}`}>
                  <button type="button" onClick={() => toggle(g.label!)} aria-expanded={openMenu === g.label}
                    className={`${topBtn} ${groupActive(g) ? "text-brand-dark" : "text-neutral-600"} hover:bg-[#F6F1E6]`}>
                    {g.label} {g.badge === "approvals" && badge(approvals)} <span className="text-[10px] opacity-60">▼</span>
                  </button>
                  <div className={ddPanel}>
                    {g.items.map((n) => itemLink(n, ddLink(active(n.href))))}
                  </div>
                </div>
              ),
            )}
            <span className="ml-1"><NotificationBell /></span>
            {!isEmployee && itemLink({ ...staffHub, label: "Staff Hub ↗︎" }, `${topBtn} text-neutral-600 hover:bg-[#F6F1E6]`)}
            <div className={`top-mi relative ${openMenu === "__acct" ? "open" : ""}`}>
              <button type="button" onClick={() => toggle("__acct")} aria-label="Account"
                className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-brand-dark text-sm font-semibold text-white">
                {user.name.charAt(0).toUpperCase()}
              </button>
              <div className={ddPanel}>
                <div className="px-2.5 py-1.5">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-neutral-500">{ROLE_LABEL[user.role] ?? user.role}</p>
                </div>
                {accountItems(ddLink)}
              </div>
            </div>
          </nav>

          {/* Phone */}
          <span className="ml-auto flex items-center gap-1.5 md:hidden">
            <span className={isEmployee ? "[&_button]:text-white [&_button:hover]:bg-white/15" : ""}>
              <NotificationBell />
            </span>
            {isEmployee ? (
              <span className="relative">
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
                    <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-neutral-200 bg-white p-2 text-ink shadow-lg">
                      <div className="px-2 py-1.5">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-neutral-400">{ROLE_LABEL[user.role] ?? user.role}</p>
                      </div>
                      {accountItems((on) => `flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-100 ${on ? "font-semibold" : ""}`)}
                    </div>
                  </>
                )}
              </span>
            ) : (
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu"
                className="grid h-10 w-10 place-items-center rounded-xl bg-[#F6F1E6] text-lg">☰</button>
            )}
          </span>
        </div>
      </header>

      {/* Phone drawer — managers/hr/admin (employees use the BottomNav) */}
      {!isEmployee && (
        <>
          <div onClick={() => setDrawerOpen(false)}
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity motion-reduce:transition-none md:hidden ${drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
          <aside aria-hidden={!drawerOpen}
            className={`fixed inset-y-0 right-0 z-50 flex w-[min(88vw,340px)] flex-col bg-white transition-transform duration-200 motion-reduce:transition-none md:hidden ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <span className="text-[17px] font-bold">Menu</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-lg text-xl">✕</button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2.5 pb-6 pt-1">
              <p className="px-2.5 pb-1 pt-2 text-xs text-neutral-500">{user.name} · {ROLE_LABEL[user.role] ?? user.role}</p>
              {nav.map((g, gi) => (
                <div key={gi}>
                  {g.label && (
                    <h4 className="mx-2 mb-1 mt-3.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                      {g.label} {g.badge === "approvals" && badge(approvals)}
                    </h4>
                  )}
                  {g.items.map((n) => itemLink(n, drawerLink(active(n.href))))}
                </div>
              ))}
              <h4 className="mx-2 mb-1 mt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Account</h4>
              {itemLink(staffHub, drawerLink(false))}
              {accountItems(drawerLink)}
            </nav>
          </aside>
        </>
      )}

      <main className={`mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 ${isEmployee ? "pb-24 md:pb-6" : ""}`}>{children}</main>

      {isEmployee && <BottomNav items={nav.flatMap((g) => g.items)} />}

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}
