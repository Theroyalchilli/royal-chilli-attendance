import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell, { type NavItem } from "@/components/Shell";

const NAV: NavItem[] = [
  { href: "/me", label: "Dashboard", icon: "🏠" },
  { href: "/me/rota", label: "My Rota", icon: "📅" },
  { href: "/me/attendance", label: "My Hours", icon: "✅" },
  { href: "/me/corrections", label: "Corrections", icon: "✏️" },
  { href: "/me/payslips", label: "Payslips", icon: "💷" },
];

// Everyone (incl. managers) can see their own account here — managers land on
// /admin by default but reach /me via the avatar menu.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <Shell user={session} nav={NAV}>
      {children}
    </Shell>
  );
}
