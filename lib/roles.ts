// The five roles — same as royal-chilli-pos lib/roles.ts. Internal keys stay;
// only the names people see changed: admin = Super admin (the group
// owners), manager, hr, employee = Front House, kitchen (new). Safe to import in the browser.

export const ROLE_LABEL: Record<string, string> = {
  admin: "Super admin",
  manager: "Manager",
  hr: "HR",
  employee: "Front House",
  kitchen: "Kitchen",
  driver: "Driver",
};

export const roleLabel = (role: string | null | undefined) => (role ? ROLE_LABEL[role] ?? role : "");

/** Front House and Kitchen: only their own pages (/me) — clock-in, rota, payslips, food safety tasks. */
export const isOwnPagesOnly = (role: string) => role === "employee" || role === "kitchen";

/** Manager level: Super admin, Manager — Managers keep everything here. */
export const isManagerLevel = (role: string) => role === "admin" || role === "manager";

/** Hands-on manager (food safety edits, training records): Manager. */
export const isHandsOnManager = (role: string) => role === "manager";

/** Roles that never appear on the rota (agreed 2026-10-03): Super admin and
 *  HR. Manager, Front House and Kitchen do. */
export const NOT_ON_ROTA = ["admin", "hr"] as const;
export const isOnRota = (role: string) => !(NOT_ON_ROTA as readonly string[]).includes(role);
