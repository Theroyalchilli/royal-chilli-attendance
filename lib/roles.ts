// The five roles — same as royal-chilli-pos lib/roles.ts. Internal keys stay;
// only the names people see changed: admin = Super admin (the group
// owners), manager, hr, employee = Front House, kitchen (new). Safe to import in the browser.

export const ROLE_LABEL: Record<string, string> = {
  admin: "Super admin",
  supervisor: "Supervisor",
  manager: "Manager",
  hr: "HR",
  employee: "Front House",
  kitchen: "Kitchen",
  bar: "Bar",
  driver: "Driver",
};

export const roleLabel = (role: string | null | undefined) => (role ? ROLE_LABEL[role] ?? role : "");

/** Front House and Kitchen: only their own pages (/me) — clock-in, rota, hours, food safety tasks. Payslips are HR-only, in the Staff Hub. */
// Bar (131) works like Front House: the till, clock-in, rota and their own pages.
export const isOwnPagesOnly = (role: string) => role === "employee" || role === "kitchen" || role === "bar";

/** Manager level: Super admin, Manager — Managers keep everything here. */
export const isManagerLevel = (role: string) => role === "admin" || role === "supervisor" || role === "manager";

/** Super admins and managers can record food safety and training updates. */
export const isHandsOnManager = (role: string) => role === "admin" || role === "supervisor" || role === "manager";

/** HR is not scheduled as operational staff. Super admins retain full rota access. */
export const NOT_ON_ROTA = ["hr", "supervisor"] as const;
export const isOnRota = (role: string) => !(NOT_ON_ROTA as readonly string[]).includes(role);
