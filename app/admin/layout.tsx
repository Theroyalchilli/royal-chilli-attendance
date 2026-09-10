import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";
import Shell, { type NavItem } from "@/components/Shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/rota", label: "Rota", icon: "📅" },
  { href: "/admin/attendance", label: "Attendance", icon: "✅" },
  { href: "/admin/corrections", label: "Corrections", icon: "✏️" },
  { href: "/admin/timesheets", label: "Timesheets", icon: "⏱️" },
  { href: "/admin/reports", label: "Reports", icon: "📊" },
  { href: "/admin/employees", label: "Employees", icon: "👥" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageAttendance(session.role)) redirect("/me");

  return (
    <Shell user={session} nav={NAV}>
      {children}
    </Shell>
  );
}
