"use client";

import { useEffect, useState } from "react";

type Payment = { amount: number; method: string | null; paid_at: string; notes: string | null };
type Payslip = {
  id: number;
  period_start: string | null;
  period_end: string | null;
  hours_worked: number;
  gross_pay: number;
  paid_amount: number;
  outstanding: number;
  status: string;
  payments: Payment[];
};

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  partially_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
};
const gbp = (n: number) => `£${n.toFixed(2)}`;
const d = (iso: string | null) => (iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?");

export default function MyPayslips() {
  const [list, setList] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/me/payslips", { cache: "no-store" })
        .then((r) => r.json())
        .then((x) => setList(x.payslips ?? []))
        .finally(() => setLoading(false));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Payslips</h1>
      <p className="mt-1 text-sm text-neutral-500">Your pay by period, and what&apos;s been paid so far.</p>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No pay periods have been processed for you yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {list.map((p) => (
            <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <button onClick={() => setOpen(open === p.id ? null : p.id)} className="flex w-full items-center justify-between text-left">
                <div>
                  <p className="font-medium">{d(p.period_start)} – {d(p.period_end)}</p>
                  <p className="text-xs text-neutral-400">{p.hours_worked} h</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{gbp(p.gross_pay)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[p.status] ?? "bg-neutral-100"}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
              </button>

              {open === p.id && (
                <div className="mt-3 border-t border-neutral-100 pt-3 text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-xs text-neutral-400">Gross</div><div className="font-medium">{gbp(p.gross_pay)}</div></div>
                    <div><div className="text-xs text-neutral-400">Paid</div><div className="font-medium text-emerald-600">{gbp(p.paid_amount)}</div></div>
                    <div><div className="text-xs text-neutral-400">Outstanding</div><div className="font-medium text-amber-600">{gbp(p.outstanding)}</div></div>
                  </div>
                  {p.payments.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-semibold uppercase text-neutral-400">Payments</p>
                      {p.payments.map((pay, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span>{new Date(pay.paid_at).toLocaleDateString("en-GB")} {pay.method && `· ${pay.method.replace("_", " ")}`}</span>
                          <span className="font-medium">{gbp(pay.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-neutral-400">Questions about your pay? Speak to a manager.</p>
    </div>
  );
}
