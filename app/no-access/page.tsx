import type { Metadata } from "next";
import StatusPage from "@/components/StatusPage";

export const metadata: Metadata = { title: "No access", robots: { index: false } };

// Where a manager-only page sends someone whose role can't open it, instead
// of silently bouncing them to their own page.
export default function NoAccessPage() {
  return (
    <StatusPage
      icon="🔒"
      title="You don't have access to this page"
      lines={["This part of Attendance is for managers.", "Ask a manager if you need it."]}
      actions={[{ label: "Go to my page", href: "/me", primary: true }]}
    />
  );
}
