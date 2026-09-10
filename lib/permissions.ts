import type { StaffRole } from "./types";

// Mirrors royal-chilli-pos's `manage_staff` default set — the roles that reach
// Staff Hub / payroll / rota there are the ones that reach this admin console.
const ADMIN_ROLES: StaffRole[] = ["owner", "admin", "manager"];

export function canManageAttendance(role: StaffRole): boolean {
  return ADMIN_ROLES.includes(role);
}
