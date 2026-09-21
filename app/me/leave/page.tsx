"use client";

import { useCallback, useEffect, useState } from "react";
import { dayLabel } from "@/lib/format";

type Request = {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
};

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const TYPE_LABEL: Record<string, string> = {
  holiday: "Holiday",
  sick: "Sick",
  unpaid: "Unpaid",
  other: "Other",
};

export default function MyLeave() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/me/leave", { cache: "no-store" });
    const d = await res.json();
    setRequests(d.requests ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Time Off</h1>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Request time off
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Ask a manager to approve holiday, sick leave, or other time off.</p>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No requests yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {TYPE_LABEL[r.leave_type] ?? r.leave_type} · {dayLabel(r.start_date)}
                  {r.start_date !== r.end_date && ` – ${dayLabel(r.end_date)}`}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status] ?? "bg-neutral-100"}`}>{r.status}</span>
              </div>
              {r.reason && <p className="mt-1 text-sm text-neutral-600">&ldquo;{r.reason}&rdquo;</p>}
              <p className="mt-1 text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString("en-GB")}</p>
            </div>
          ))}
        </div>
      )}

      {open && <RequestModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function RequestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [leaveType, setLeaveType] = useState("holiday");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!startDate || !endDate) return setErr("Pick both dates");
    if (startDate > endDate) return setErr("End date is before start date");
    setBusy(true);
    setErr("");
    const res = await fetch("/api/me/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Failed");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="font-semibold">Request time off</h2>

        <label className="mt-4 block text-xs text-neutral-500">Type</label>
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="holiday">Holiday</option>
          <option value="sick">Sick</option>
          <option value="unpaid">Unpaid</option>
          <option value="other">Other</option>
        </select>

        <div className="mt-3 flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-neutral-500">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-neutral-500">End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <label className="mt-3 block text-xs text-neutral-500">Reason (optional)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="e.g. family holiday" />

        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-semibold hover:bg-neutral-200">Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
