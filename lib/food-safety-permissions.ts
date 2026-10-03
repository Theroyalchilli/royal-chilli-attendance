import type { StaffRole } from "./types";
import { isHandsOnManager, isManagerLevel, isOwnPagesOnly } from "./roles";

// Front House and Kitchen count as "employee" here; Supervisor as "manager".
//
// Deliberately not the same shape as the rest of this app's permissions —
// see HANDOVER.md §2/§3: HR is excluded from this module entirely (food
// safety is a kitchen operation, not a people one), and sign-off is
// normally manager/admin-only but can be delegated to a specific senior
// employee via staff.can_signoff (e.g. a head chef covering while the
// manager's away) — a per-person flag, not a role.
//
// Admin was originally view-only on Tasks (oversight, not hands-on
// logging), matching the doc. Changed on request to full parity with
// Manager — same reasoning already applied to Config and Records: Admin
// in a small operation is often also hands-on in the kitchen, and
// blocking them from logging a check they're physically doing was pure
// friction with no real separation-of-duties benefit.

export function canViewFoodSafety(role: StaffRole): boolean {
  return isOwnPagesOnly(role) || isManagerLevel(role);
}

export function canLogFoodSafety(role: StaffRole): boolean {
  return isOwnPagesOnly(role) || isManagerLevel(role);
}

export function canSignoffFoodSafety(role: StaffRole, canSignoffFlag: boolean): boolean {
  if (isManagerLevel(role)) return true;
  if (isOwnPagesOnly(role)) return canSignoffFlag;
  return false; // hr (no access) never signs off
}

// Trace (deliveries + approved-supplier register) — unlike Tasks, employees
// have no access to this at all, per HANDOVER.md §3's role table.
export function canViewTrace(role: StaffRole): boolean {
  return isManagerLevel(role);
}
export function canEditTrace(role: StaffRole): boolean {
  return isHandsOnManager(role);
}

// Team/training — everyone with any access sees the whole team's status;
// only a manager can record a new completion. Employees don't use this at
// all (they only ever see their own record, via /me/food-safety/training).
export function canViewTeamTraining(role: StaffRole): boolean {
  return isManagerLevel(role);
}
export function canRecordTraining(role: StaffRole): boolean {
  return isHandsOnManager(role);
}

// Config (check/temp task list, training courses) — the doc puts this
// admin-only ("Config" is the one place Admin has power, since it's rules
// not day-to-day operation). Extended to Manager too on request; still
// excludes Employee and HR entirely.
export function canEditFoodSafetyConfig(role: StaffRole): boolean {
  return isManagerLevel(role);
}

// Records (the SFBB-style day-by-day export). The doc actually splits this
// one further than every other row — Manager "Full", Admin "Full + export"
// — but given Manager already has full access everywhere else in this
// module, both get full view + export here too, same as Config.
export function canViewFoodSafetyRecords(role: StaffRole): boolean {
  return isManagerLevel(role);
}
