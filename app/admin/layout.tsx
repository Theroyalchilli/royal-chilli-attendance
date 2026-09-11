import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";
import Shell, { type NavItem } from "@/components/Shell";

const NAV: (NavItem & { adminOnly?: boolean })[] = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/rota", label: "Rota", icon: "📅" },
  { href: "/admin/attendance", label: "Attendance", icon: "✅" },
  { href: "/admin/corrections", label: "Corrections", icon: "✏️" },
  { href: "/admin/timesheets", label: "Timesheets", icon: "⏱️" },
  { href: "/admin/reports", label: "Reports", icon: "📊" },
  { href: "/admin/employees", label: "Employees", icon: "👥" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", adminOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageAttendance(session.role)) redirect("/me");

  const nav = NAV.filter((n) => !n.adminOnly || session.role === "admin");

  return (
    <Shell user={session} nav={nav}>
      {children}
    </Shell>
  );
}
