import supabase from "@/lib/supabase";

// Time-off requests + time corrections waiting on a manager — the number on
// the top bar's "Approvals" menu.
export async function pendingApprovals(): Promise<number> {
  const [leave, corrections] = await Promise.all([
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (leave.count ?? 0) + (corrections.count ?? 0);
}
