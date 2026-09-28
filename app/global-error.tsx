"use client";

import { useEffect, useState } from "react";
import { reloadOnceForStaleVersion } from "@/lib/chunk-error";

// A crash in the root layout itself — replaces the whole page, so inline styles.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    console.error("[global error]", error);
    if (reloadOnceForStaleVersion(error)) setReloading(true);
  }, [error]);

  const btn = { flex: 1, padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" } as const;
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fafaf9", color: "#1c1917", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          {reloading ? (
            <p style={{ fontSize: 14, color: "#78716c" }}>Updating to the latest version…</p>
          ) : (
            <div style={{ maxWidth: 360 }}>
              <h1 style={{ fontSize: 24, margin: "0 0 10px" }}>Something went wrong 🌶️</h1>
              <p style={{ fontSize: 14, color: "#78716c", margin: 0 }}>We&apos;re sorry — this page couldn&apos;t be loaded properly.</p>
              <p style={{ fontSize: 14, color: "#78716c", margin: "8px 0 0" }}>Please try again. If the problem continues, return to the homepage and try again in a moment.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button onClick={() => window.location.reload()} style={{ ...btn, background: "#dc2626", color: "#fff", border: "none" }}>Try Again</button>
                <button onClick={() => (window.location.href = "/")} style={{ ...btn, background: "transparent", color: "#1c1917", border: "1px solid #d6d3d1" }}>Back to Home</button>
              </div>
              <p style={{ fontSize: 12, color: "#78716c", marginTop: 24 }}>If you still need help, please contact The Royal Chilli team.</p>
              <p style={{ fontSize: 12, color: "#78716c", margin: 0 }}>Authentic Flavours. Memorable Experiences.</p>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
