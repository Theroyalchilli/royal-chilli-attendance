import type { StaffRole } from "./types";

// `group` clusters items under a shared heading inside BottomNav's "More"
// sheet (e.g. Tasks/Allergens/My Training under "Food Safety") — it's
// ignored everywhere else (the plain sidebar list, mobile drawer).
export type NavItem = { href: string; label: string; icon: string; group?: string };
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
    { href: "/me/requests", label: isEmployee ? "Requests" : "My Requests", icon: "🌴" },
  ];

  // Employees get a fixed 5-slot bottom nav (BottomNav) instead of this
  // sidebar/drawer — the first 4 items above go directly on it, everything
  // pushed after them (food safety, payslips) collapses into its "More"
  // sheet. Food safety sits under "Me" only for employees: managers/admin
  // reach the same checks with full edit/sign-off rights via their own
  // Team > Food Safety area, so it isn't duplicated here for them.
  if (isEmployee) {
    me.push(
      { href: "/me/food-safety", label: "Tasks", icon: "📋", group: "Food Safety" },
      { href: "/me/food-safety/allergens", label: "Allergens", icon: "⚠️", group: "Food Safety" },
      { href: "/me/food-safety/training", label: "My Training", icon: "🎓", group: "Food Safety" },
      { href: "/me/payslips", label: "Payslips", icon: "💷" },
    );
    return [{ items: me }];
  }

  me.push({ href: "/me/payslips", label: "My Payslips", icon: "💷" });

  const team: NavItem[] = [
    { href: "/api/sso/staffhub", label: "Staff Hub", icon: "🍽️" },
    { href: "/admin", label: "Dashboard", icon: "🏠" },
    { href: "/admin/rota", label: "Rota", icon: "📅" },
    { href: "/admin/attendance", label: "Attendance", icon: "✅" },
    { href: "/admin/leave", label: "Time Off", icon: "🌴" },
    { href: "/admin/corrections", label: "Corrections", icon: "✏️" },
    { href: "/admin/timesheets", label: "Timesheets", icon: "⏱️" },
    { href: "/admin/reports", label: "Reports", icon: "📊" },
    { href: "/admin/employees", label: "Employees", icon: "👥" },
  ];
  // Food safety is deliberately excluded from HR entirely (HANDOVER.md §2) —
  // it's a kitchen operation, not a people one. Manager gets full access
  // (Tasks reuses the same role-aware /me/food-safety page employees use);
  // admin sees the same links but every screen behind them is view-only.
  if (role !== "hr") {
    team.push(
      { href: "/me/food-safety", label: "Food Safety", icon: "📋" },
      { href: "/admin/food-safety/trace", label: "Trace", icon: "🚚" },
      { href: "/admin/food-safety/training", label: "Team Training", icon: "🎓" },
      { href: "/admin/food-safety/records", label: "Food Safety Records", icon: "🖨️" },
      { href: "/admin/food-safety/config", label: "Food Safety Config", icon: "⚙️" },
    );
  }
  if (role === "admin") team.push({ href: "/admin/settings", label: "Settings", icon: "⚙️" });

  return [
    { label: "Team", items: team },
    { label: "Me", items: me },
  ];
}
