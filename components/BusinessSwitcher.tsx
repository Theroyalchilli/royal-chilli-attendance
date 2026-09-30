"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SwitcherOption = { id: number; name: string; active: boolean };

// The group owner's "Working in" picker — switching gives a fresh login for
// that business and reloads Attendance inside it (mirrors the Staff Hub's).
export default function BusinessSwitcher({ current, options, className = "" }: { current: number; options: SwitcherOption[]; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(id: number) {
    if (id === current) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/switch-business", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: id }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Couldn't switch");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <label className={`flex items-center gap-2 text-[12.5px] text-neutral-500 ${className}`}>
      <span className="whitespace-nowrap">Working in</span>
      <select
        value={current}
        disabled={busy}
        onChange={(e) => change(Number(e.target.value))}
        className="max-w-[190px] rounded-lg border border-line bg-[#F6F1E6] px-2 py-1.5 text-[13px] font-semibold text-ink"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}{o.active ? "" : " (not open yet)"}</option>
        ))}
      </select>
      {error && <span className="text-brand">{error}</span>}
    </label>
  );
}
