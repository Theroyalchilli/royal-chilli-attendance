import type { StaffRole } from "./types";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { label?: string; items: NavItem[] };

// One sidebar for every role. An employee sees only their own section; a
// manager/hr/admin sees the team console AND their own pages, so they never
// lose the nav when they open their rota/payslips. Same on every device.
export function navFor(role: StaffRole): NavGroup[] {
  const isEmployee = role === "employee";

  const me: NavItem[] = [
    { href: "/me", label: isEmployee ? "Dashboard" : "My Dashboard", icon: "🏠" },
    { href: "/me/rota", label: "My Rota", icon: "📅" },
    { href: "/me/attendance", label: "My Hours", icon: "✅" },
    { href: "/me/corrections", label: isEmployee ? "Corrections" : "My Corrections", icon: "✏️" },
    { href: "/me/payslips", label: isEmployee ? "Payslips" : "My Payslips", icon: "💷" },
  ];

  if (isEmployee) return [{ items: me }];

  const team: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "🏠" },
    { href: "/admin/rota", label: "Rota", icon: "📅" },
    { href: "/admin/attendance", label: "Attendance", icon: "✅" },
    { href: "/admin/corrections", label: "Corrections", icon: "✏️" },
    { href: "/admin/timesheets", label: "Timesheets", icon: "⏱️" },
    { href: "/admin/reports", label: "Reports", icon: "📊" },
    { href: "/admin/employees", label: "Employees", icon: "👥" },
  ];
  if (role === "admin") team.push({ href: "/admin/settings", label: "Settings", icon: "⚙️" });

  return [
    { label: "Team", items: team },
    { label: "Me", items: me },
  ];
}
