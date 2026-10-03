import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { ConfirmHost } from "@/components/ui/confirm";
import { headers } from "next/headers";
import { businessForHost } from "@/lib/business";
import { appUrl } from "@/lib/app-hosts";

// Same face used for "The Royal Chilli" on the customer account header —
// keeps the two apps' branding consistent.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-playfair",
});

// The business comes from the address (attendance.melthouse.co.uk -> Melt
// House), so a shared link names the right business and shows its picture —
// drawn by the POS (/og). Unknown addresses keep the original Royal Chilli name.
const DESCRIPTION = "Clock in and out, see your rota, request leave and view payslips.";

export async function generateMetadata(): Promise<Metadata> {
  const b = await businessForHost((await headers()).get("host")).catch(() => null);
  const name = b?.name ?? "The Royal Chilli";
  const title = `${name} — Attendance`;
  const pos = appUrl(b?.domain, "staff") ?? (process.env.NEXT_PUBLIC_POS_URL || "https://royal-chilli-pos.vercel.app");
  const image = `${pos}/og?for=attendance${b?.login_code ? `&code=${encodeURIComponent(b.login_code)}` : ""}`;
  return {
    ...BASE_METADATA,
    title,
    description: DESCRIPTION,
    openGraph: { title, description: DESCRIPTION, siteName: name, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image" },
  };
}

const BASE_METADATA: Metadata = {
  robots: { index: false, follow: false },
  manifest: "/manifest.json",
  // iPhone: opens full-screen from the Home Screen — required for phone notifications
  appleWebApp: { capable: true, title: "Attendance", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={playfair.variable}>
      <body className="min-h-full bg-cream text-ink antialiased">{children}<ConfirmHost /></body>
    </html>
  );
}
