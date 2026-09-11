import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import Shell from "@/components/Shell";

// Everyone (incl. managers) reaches their own account here. Managers keep the
// full sidebar (Team + Me sections) so they never lose the admin nav.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <Shell user={session} nav={navFor(session.role)}>
      {children}
    </Shell>
  );
}
