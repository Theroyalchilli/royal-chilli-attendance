import type { StaffRole } from "./types";

// The attendance admin console (this app) maps to the POS's "attendance" tab:
// Super admin, Manager and HR. Front House and Kitchen only ever
// see their own /me pages.
export function canManageAttendance(role: StaffRole): boolean {
  return role === "manager" || role === "hr" || role === "admin";
}
