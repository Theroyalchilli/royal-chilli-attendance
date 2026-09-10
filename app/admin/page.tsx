import supabase from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export default async function AdminDashboard() {
  const session = await getSession();

  // Cheap liveness check that the shared database is reachable.
  const { count } = await supabase
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("active", 1);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Welcome, {session?.name}.</p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-600">
          Connected to the shared Supabase database — {count ?? 0} active staff.
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          The dashboard, attendance list, corrections, timesheets, rota and reports land in Phase 5+.
        </p>
      </div>
    </div>
  );
}
