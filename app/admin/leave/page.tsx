"use client";

import { useCallback, useEffect, useState } from "react";
import { dayLabel } from "@/lib/format";

type Leave = {
  id: number;
  staff_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  holiday: "Holiday",
  sick: "Sick",
  unpaid: "Unpaid",
  other: "Other",
};

export default function AdminLeavePage() {
  const [rows, setRows] = useState<Leave[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/leave?status=${status}`, { cache: "no-store" });
    setRows((await res.json()).rows ?? []);
    setLoading(false);
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  async function review(id: number, action: "approve" | "reject") {
    if (action === "reject" && !confirm("Reject this leave request?")) return;
    setBusy(id);
    await fetch(`/api/admin/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Time Off</h1>
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
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.staff_name}</span>
                <span className="text-xs text-neutral-400">{dayLabel(r.created_at.slice(0, 10))}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {TYPE_LABEL[r.leave_type] ?? r.leave_type} · {dayLabel(r.start_date)}
                {r.start_date !== r.end_date && ` – ${dayLabel(r.end_date)}`}
              </p>
              {r.reason && <p className="mt-1 text-sm text-neutral-500">&ldquo;{r.reason}&rdquo;</p>}
              {r.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => review(r.id, "approve")} disabled={busy === r.id} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
                  <button onClick={() => review(r.id, "reject")} disabled={busy === r.id} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
