import { bizDb } from "@/lib/business-db";

// Time-off requests + time corrections waiting on a manager — the number on
// the top bar's "Approvals" menu.
export async function pendingApprovals(businessId: number): Promise<number> {
  const [leave, corrections] = await Promise.all([
    bizDb(businessId).from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    bizDb(businessId).from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (leave.count ?? 0) + (corrections.count ?? 0);
}
