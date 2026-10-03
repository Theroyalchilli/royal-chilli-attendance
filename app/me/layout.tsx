import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import Shell from "@/components/Shell";
import { pendingApprovals } from "@/lib/approvals";
import { headerBusiness } from "@/lib/business";
import { isOwnPagesOnly } from "@/lib/roles";

// Everyone (incl. managers) reaches their own account here. Managers keep the
// full menu (Team + Me sections) so they never lose the admin nav.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const approvals = isOwnPagesOnly(session.role) ? 0 : await pendingApprovals(session.businessId).catch(() => 0);

  return (
    <Shell user={session} nav={navFor(session.role)} approvals={approvals} business={await headerBusiness(session)}>
      {children}
    </Shell>
  );
}
