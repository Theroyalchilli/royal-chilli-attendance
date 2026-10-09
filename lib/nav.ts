import type { StaffRole } from "./types";
import { isManagerLevel, isOwnPagesOnly } from "./roles";

// `group` clusters items under a shared heading inside BottomNav's "More"
// sheet (e.g. Tasks/Allergens/My Training under "Food Safety").
export type NavItem = { href: string; label: string; icon: string; group?: string };
// The top bar, left to right. A group with no label is plain links on the
// bar; a labelled group is a dropdown (hover with a mouse, tap on touch).
// `badge: "approvals"` shows the count of time-off + corrections waiting.
export type NavGroup = { label?: string; items: NavItem[]; badge?: "approvals" };

// One menu for every role, same on every device (phones get it in the ☰
// drawer — except employees, whose phones keep the BottomNav, fed from the
// same items flattened). Managers/hr/admin see the team console AND their own
// pages, so they never lose the nav when they open their rota/payslips.
export function navFor(role: StaffRole): NavGroup[] {
  if (isOwnPagesOnly(role)) {
    // The first 4 are the BottomNav's direct slots; the rest go in its "More".
    return [
      {
        items: [
          { href: "/me", label: "Dashboard", icon: "🏠" },
          { href: "/me/rota", label: "My Rota", icon: "📅" },
          { href: "/me/attendance", label: "My Hours", icon: "✅" },
          { href: "/me/requests", label: "Requests", icon: "🌴" },
        ],
      },
      {
        label: "Food Safety",
        items: [
          { href: "/me/food-safety", label: "Tasks", icon: "📋", group: "Food Safety" },
          { href: "/me/food-safety/allergens", label: "Allergens", icon: "⚠️", group: "Food Safety" },
          { href: "/me/food-safety/training", label: "My Training", icon: "🎓", group: "Food Safety" },
        ],
      },
      { items: [{ href: "/me/payslips", label: "Payslips", icon: "💷" }] },
    ];
  }

  const groups: NavGroup[] = [
    { items: [{ href: "/admin", label: "Dashboard", icon: "🏠" }] },
    {
      label: "Shifts",
      items: [
        { href: "/admin/rota", label: "Rota", icon: "📅" },
        { href: "/admin/attendance", label: "Attendance", icon: "✅" },
        { href: "/admin/timesheets", label: "Timesheets", icon: "⏱️" },
        { href: "/admin/reports", label: "Reports", icon: "📊" },
      ],
    },
    {
      label: "Approvals",
      badge: "approvals",
      items: [
        { href: "/admin/leave", label: "Time Off", icon: "🌴" },
        { href: "/admin/corrections", label: "Corrections", icon: "✏️" },
      ],
    },
    {
      label: "Team",
      items: [
        { href: "/admin/employees", label: "Employees", icon: "👥" },
        // managers and admins can message staff (phone + bell)
        ...(isManagerLevel(role) ? [{ href: "/admin/messages", label: "Messages", icon: "📣" }] : []),
      ],
    },
  ];

  // Food safety is deliberately excluded from HR entirely (HANDOVER.md §2) —
  // it's a kitchen operation, not a people one. Super admins and managers can
  // both edit trace records and record team training.
  if (role !== "hr") {
    groups.push({
      label: "Food Safety",
      items: [
        { href: "/admin/food-safety", label: "Tasks", icon: "📋" },
        { href: "/admin/food-safety/training", label: "Team Training", icon: "🎓" },
        { href: "/admin/food-safety/records", label: "Records", icon: "🖨️" },
        { href: "/admin/food-safety/trace", label: "Trace", icon: "🚚" },
        { href: "/admin/food-safety/config", label: "Config", icon: "⚙️" },
      ],
    });
  }

  groups.push({
    label: "Me",
    items: [
      { href: "/me", label: "My Dashboard", icon: "🏠" },
      { href: "/me/rota", label: "My Rota", icon: "📅" },
      { href: "/me/attendance", label: "My Hours", icon: "✅" },
      { href: "/me/requests", label: "My Requests", icon: "🌴" },
      { href: "/me/payslips", label: "My Payslips", icon: "💷" },
      { href: "/me/notifications", label: "Notification settings", icon: "🔔" },
    ],
  });
  return groups;
}
