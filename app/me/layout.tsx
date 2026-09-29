import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import Shell from "@/components/Shell";
import { pendingApprovals } from "@/lib/approvals";

// Everyone (incl. managers) reaches their own account here. Managers keep the
// full menu (Team + Me sections) so they never lose the admin nav.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const approvals = session.role === "employee" ? 0 : await pendingApprovals().catch(() => 0);

  return (
    <Shell user={session} nav={navFor(session.role)} approvals={approvals}>
      {children}
    </Shell>
  );
}
