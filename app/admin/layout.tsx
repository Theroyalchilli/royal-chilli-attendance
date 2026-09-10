import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";
import LogoutButton from "./LogoutButton";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/corrections", label: "Corrections" },
  { href: "/admin/timesheets", label: "Timesheets" },
  { href: "/admin/rota", label: "Rota" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/employees", label: "Employees" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageAttendance(session.role)) redirect("/login");

  return (
    <div className="min-h-dvh md:flex">
      <aside className="border-b border-neutral-200 bg-white md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-4 text-sm font-semibold tracking-tight">Attendance admin</div>
        <nav className="px-2 pb-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
          <span className="text-sm text-neutral-400">
            {session.name} · {session.role}
          </span>
          <LogoutButton />
        </header>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
