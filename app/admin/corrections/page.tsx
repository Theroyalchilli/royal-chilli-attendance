"use client";

import { useCallback, useEffect, useState } from "react";
import { dayLabel } from "@/lib/format";

type Corr = {
  id: number;
  staff_name: string;
  attendance_id: number | null;
  original_snapshot: Record<string, unknown>;
  requested_change: Record<string, unknown>;
  reason: string;
  status: string;
  created_at: string;
  review_note: string | null;
};

const val = (v: unknown) => (v == null ? "—" : typeof v === "string" && v.includes("T") ? new Date(v).toLocaleString("en-GB") : String(v));

export default function CorrectionsPage() {
  const [rows, setRows] = useState<Corr[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/corrections?status=${status}`, { cache: "no-store" });
    setRows((await res.json()).rows ?? []);
    setLoading(false);
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  async function review(id: number, action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Reason for rejecting (optional):") ?? "" : "";
    setBusy(id);
    await fetch(`/api/admin/corrections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, review_note: note }),
    });
    setBusy(null);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Corrections</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">Nothing here.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((c) => (
            <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.staff_name}</span>
                <span className="text-xs text-neutral-400">{dayLabel(c.created_at.slice(0, 10))}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">“{c.reason}”</p>
              <div className="mt-3 space-y-1 text-xs">
                {Object.entries(c.requested_change).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="w-40 text-neutral-400">{k}</span>
                    <span className="text-neutral-400 line-through">{val(c.original_snapshot[k])}</span>
                    <span>→</span>
                    <span className="font-medium">{val(v)}</span>
                  </div>
                ))}
              </div>
              {c.review_note && <p className="mt-2 text-xs text-neutral-500">Note: {c.review_note}</p>}
              {c.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => review(c.id, "approve")} disabled={busy === c.id} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
                  <button onClick={() => review(c.id, "reject")} disabled={busy === c.id} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
