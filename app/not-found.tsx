import type { Metadata } from "next";
import StatusPage from "@/components/StatusPage";

// Any address that doesn't exist: same look as the other status pages, with a way back to the start.
export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <StatusPage
      icon="🔎"
      title="Page not found"
      lines={["This page doesn't exist, or the link is out of date.", "Go back to the start and try again from there."]}
      actions={[{ label: "Back to start", href: "/", primary: true }]}
      note="If you still need help, please ask your manager."
    />
  );
}
