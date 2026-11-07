"use client";

import { useEffect, useRef, useState } from "react";
import { freshStart } from "@/lib/auth-sync";

export type SwitcherOption = { id: number; name: string; active: boolean; logo_url?: string | null };

const shortName = (name: string) =>
  name.split(/\s+/).filter((w) => w.toLowerCase() !== "the").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Mark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (logoUrl) return <img src={logoUrl} alt="" className="h-6 w-6 flex-shrink-0 rounded object-contain" />;
  return <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded bg-ink text-[9px] font-bold text-white">{shortName(name)}</span>;
}

// The group owner's "Working in" picker, with each business's logo — switching
// gives a fresh login for that business and reloads Attendance inside it, in
// its colours (mirrors the Staff Hub's).
export default function BusinessSwitcher({ current, options, className = "" }: { current: number; options: SwitcherOption[]; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function change(id: number) {
    setOpen(false);
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
    freshStart("/admin");
  }

  const chosen = options.find((o) => o.id === current);

  return (
    <div ref={box} className={`relative flex items-center gap-2 text-[12.5px] text-neutral-500 ${className}`}>
      <span className="whitespace-nowrap">Working in</span>
      <button
        type="button" disabled={busy} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="flex max-w-[210px] items-center gap-1.5 rounded-lg border border-line bg-brand-cream px-2 py-1 text-[13px] font-semibold text-ink disabled:opacity-60"
      >
        {chosen && <Mark name={chosen.name} logoUrl={chosen.logo_url} />}
        <span className="truncate">{chosen?.name ?? "Choose"}</span>
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[250px] rounded-xl border border-line bg-white p-1.5 shadow-lg">
          {options.map((o) => (
            <button key={o.id} type="button" onClick={() => change(o.id)} aria-current={o.id === current}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-ink hover:bg-brand-cream ${o.id === current ? "bg-brand-tint" : ""}`}>
              <Mark name={o.name} logoUrl={o.logo_url} />
              <span className="min-w-0">{o.name}{o.active ? "" : <small className="block font-normal text-neutral-500">Not open yet</small>}</span>
            </button>
          ))}
        </div>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
