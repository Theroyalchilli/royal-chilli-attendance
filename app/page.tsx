import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// No more kiosk screen — we're phone-only. Send everyone straight to
// their dashboard, or the login form if they're signed out.
export default async function RootPage() {
  const session = await getSession();
  redirect(session ? (session.role === "employee" ? "/me" : "/admin") : "/login");
}
