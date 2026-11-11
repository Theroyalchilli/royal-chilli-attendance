import { redirect } from "next/navigation";
import { getSession, isViewOnly } from "@/lib/auth";
import { canManageAttendance } from "@/lib/permissions";
import { navFor } from "@/lib/nav";
import Shell from "@/components/Shell";
import { pendingApprovals } from "@/lib/approvals";
import { headerBusiness } from "@/lib/business";
import { isOwnPagesOnly } from "@/lib/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageAttendance(session.role)) redirect("/no-access");

  const [approvals, business] = await Promise.all([
    isOwnPagesOnly(session.role) ? 0 : pendingApprovals(session.businessId).catch(() => 0),
    headerBusiness(session),
  ]);

  return (
    <Shell user={session} nav={navFor(session.role)} approvals={approvals} business={business}>
      {session.owner && (await isViewOnly(session.id)) && (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-[13px] font-medium text-amber-900">
          👁 View only login: you can see everything, but this login can&apos;t change or save anything.
        </div>
      )}
      {children}
    </Shell>
  );
}
