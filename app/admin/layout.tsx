import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";
import { navFor } from "@/lib/nav";
import Shell from "@/components/Shell";
import { pendingApprovals } from "@/lib/approvals";
import { headerBusiness } from "@/lib/business";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageAttendance(session.role)) redirect("/me");

  const approvals = session.role === "employee" ? 0 : await pendingApprovals(session.businessId).catch(() => 0);

  return (
    <Shell user={session} nav={navFor(session.role)} approvals={approvals} business={await headerBusiness(session)}>
      {children}
    </Shell>
  );
}
