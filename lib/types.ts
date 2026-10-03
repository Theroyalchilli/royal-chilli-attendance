// Matches royal-chilli-pos's `staff.role`: six roles (names in lib/roles.ts).
export type StaffRole = "employee" | "kitchen" | "manager" | "supervisor" | "hr" | "admin";

export type SessionUser = {
  id: number;
  name: string;
  role: StaffRole;
  /** The business this login is working for (shared with royal-chilli-pos). */
  businessId: number;
  /** The group owner (can switch business in the Staff Hub). */
  owner?: boolean;
};

export type ClockMethod = "kiosk" | "web" | "qr" | "manual";

export type AttendanceRow = {
  id: number;
  staff_id: number;
  work_date: string;
  shift_id: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_method: ClockMethod | null;
  clock_out_method: ClockMethod | null;
  clock_in_photo: string | null;
  clock_out_photo: string | null;
  break_override_minutes: number | null;
  adjustment_seconds: number;
  break_seconds: number;
  net_work_seconds: number;
  regular_seconds: number;
  overtime_seconds: number;
  late_seconds: number;
  early_departure_seconds: number;
  is_overnight: boolean;
  status: "not_started" | "clocked_in" | "clocked_out" | "absent" | "leave" | "holiday";
  photo_missing: boolean;
  approval_status: "auto" | "pending" | "approved" | "rejected";
  approved_by: number | null;
  approved_at: string | null;
  entered_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
