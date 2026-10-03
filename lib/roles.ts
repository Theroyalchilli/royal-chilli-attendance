// The six roles — same as royal-chilli-pos lib/roles.ts. Internal keys stay;
// only the names people see changed: admin = Super admin (only one, the
// group owner), supervisor (new, above Manager), manager, hr, employee =
// Front House, kitchen (new). Safe to import in the browser.

export const ROLE_LABEL: Record<string, string> = {
  admin: "Super admin",
  supervisor: "Supervisor",
  manager: "Manager",
  hr: "HR",
  employee: "Front House",
  kitchen: "Kitchen",
  driver: "Driver",
};

export const roleLabel = (role: string | null | undefined) => (role ? ROLE_LABEL[role] ?? role : "");

/** Front House and Kitchen: only their own pages (/me) — clock-in, rota, payslips, food safety tasks. */
export const isOwnPagesOnly = (role: string) => role === "employee" || role === "kitchen";

/** Manager level: Super admin, Supervisor, Manager — Managers keep everything here. */
export const isManagerLevel = (role: string) => role === "admin" || role === "supervisor" || role === "manager";

/** Hands-on manager (food safety edits, training records): Supervisor or Manager. */
export const isHandsOnManager = (role: string) => role === "supervisor" || role === "manager";
