"use client";

import { useCallback, useEffect, useState } from "react";

type StaffRef = { name: string } | null;
type CheckLog = { id: number; ok: boolean; problem_note: string | null; created_at: string; check_type: { check_window: string; label: string } | null; staff: StaffRef };
type TempLog = { id: number; value: number; pass: boolean; corrective_action: string | null; created_at: string; temp_type: { label: string; unit: string } | null; staff: StaffRef };
type Problem = { id: number; what: string; action: string; created_at: string; staff: StaffRef };
type Delivery = { id: number; item: string; temp_value: number | null; accepted: boolean; corrective_action: string | null; created_at: string; supplier: { name: string } | null; staff: StaffRef };
type Signoff = { id: number; created_at: string; staff: StaffRef } | null;
type Records = { date: string; check_logs: CheckLog[]; temp_logs: TempLog[]; problems: Problem[]; deliveries: Delivery[]; signoff: Signoff };

const WINDOW_ORDER = ["opening", "service", "closing", "weekly"] as const;
const WINDOW_LABEL: Record<string, string> = { opening: "Opening", service: "Service", closing: "Closing", weekly: "Weekly" };
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dateLabel = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// The browser's own local date is a fine default for "today" here — the
// date picker lets staff correct it in the (rare) case a device's clock is
// in a different zone, and every record itself is timestamped server-side
// regardless of what this default picks.
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RecordsPage() {
  const [date, setDate] = useState<string>(todayLocal);
  const [data, setData] = useState<Records | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (d: string) => {
    setData(null);
    setError("");
    const res = await fetch(`/api/food-safety/records?date=${d}`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) { setError(body.error || "Failed to load"); return; }
    setData(body);
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const checksByWindow = (w: string) => (data?.check_logs ?? []).filter((c) => c.check_type?.check_window === w);

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="print:hidden">
        <h1 className="text-lg font-semibold">Food Safety — Records</h1>
        <p className="mt-1 text-sm text-neutral-500">The day-by-day due-diligence record. Print or save as PDF for your files.</p>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => setDate(addDays(date, -1))} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">←</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          <button onClick={() => setDate(addDays(date, 1))} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">→</button>
          <button onClick={() => window.print()} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white">🖨️ Print / PDF</button>
        </div>
      </div>

      {!data ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 print:mt-0 print:rounded-none print:border-0 print:p-0">
          <div className="border-b border-neutral-200 pb-4 print:border-black">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">The Royal Chilli — Food Safety Record</p>
            <h2 className="mt-1 text-xl font-bold">{dateLabel(data.date)}</h2>
          </div>

          <div className={`mt-4 rounded-xl p-4 print:rounded-none print:border print:border-black ${data.signoff ? "bg-emerald-50" : "bg-red-50"}`}>
            {data.signoff ? (
              <p className="text-sm font-semibold text-emerald-700 print:text-black">
                ✓ Signed off by {data.signoff.staff?.name ?? "a manager"} at {timeOf(data.signoff.created_at)} — confirms checks were done and safe methods followed.
              </p>
            ) : (
              <p className="text-sm font-semibold text-red-600 print:text-black">⚠ Not signed off.</p>
            )}
          </div>

          {WINDOW_ORDER.map((w) => {
            const items = checksByWindow(w);
            if (items.length === 0) return null;
            return (
              <div key={w} className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">{WINDOW_LABEL[w]} checks</h3>
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {items.map((c) => (
                      <tr key={c.id} className="border-b border-neutral-100 print:border-neutral-300">
                        <td className="py-1.5 pr-2">{c.check_type?.label}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold" style={{ color: c.ok ? undefined : "#dc2626" }}>{c.ok ? "OK" : "Problem"}</td>
                        <td className="py-1.5 pr-2 text-right text-neutral-400 print:text-black">{c.staff?.name ?? "—"}</td>
                        <td className="py-1.5 text-right text-neutral-400 print:text-black">{timeOf(c.created_at)}</td>
                      </tr>
                    ))}
                    {items.filter((c) => !c.ok && c.problem_note).map((c) => (
                      <tr key={`note-${c.id}`}>
                        <td colSpan={4} className="pb-1.5 text-xs text-neutral-500">— {c.check_type?.label}: {c.problem_note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {data.temp_logs.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">Temperatures</h3>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {data.temp_logs.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100 print:border-neutral-300">
                      <td className="py-1.5 pr-2">{t.temp_type?.label}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold" style={{ color: t.pass ? undefined : "#dc2626" }}>{t.value}{t.temp_type?.unit}</td>
                      <td className="py-1.5 pr-2 text-right text-neutral-400 print:text-black">{t.staff?.name ?? "—"}</td>
                      <td className="py-1.5 text-right text-neutral-400 print:text-black">{timeOf(t.created_at)}</td>
                    </tr>
                  ))}
                  {data.temp_logs.filter((t) => !t.pass && t.corrective_action).map((t) => (
                    <tr key={`note-${t.id}`}>
                      <td colSpan={4} className="pb-1.5 text-xs text-neutral-500">— {t.temp_type?.label}: {t.corrective_action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.deliveries.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">Deliveries</h3>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {data.deliveries.map((del) => (
                    <tr key={del.id} className="border-b border-neutral-100 print:border-neutral-300">
                      <td className="py-1.5 pr-2">{del.item} <span className="text-neutral-400 print:text-black">· {del.supplier?.name ?? "?"}</span></td>
                      <td className="py-1.5 pr-2 text-right font-semibold" style={{ color: del.accepted ? undefined : "#dc2626" }}>{del.accepted ? "Accepted" : "Refused"}</td>
                      <td className="py-1.5 pr-2 text-right text-neutral-400 print:text-black">{del.staff?.name ?? "—"}</td>
                      <td className="py-1.5 text-right text-neutral-400 print:text-black">{timeOf(del.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.problems.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">Problems</h3>
              <div className="mt-2 space-y-1.5 text-sm">
                {data.problems.map((p) => (
                  <p key={p.id}><span className="font-medium">{p.what}</span> — {p.action} <span className="text-neutral-400 print:text-black">({p.staff?.name ?? "—"}, {timeOf(p.created_at)})</span></p>
                ))}
              </div>
            </div>
          )}

          {data.check_logs.length === 0 && data.temp_logs.length === 0 && data.deliveries.length === 0 && data.problems.length === 0 && (
            <p className="mt-5 text-sm text-neutral-400">Nothing logged this day.</p>
          )}

          <p className="mt-8 border-t border-neutral-200 pt-3 text-xs text-neutral-400 print:border-black print:text-black">
            Printed {new Date().toLocaleString("en-GB")}. This record is append-only — every entry above is exactly as originally logged.
          </p>
        </div>
      )}
    </div>
  );
}
