"use client";

import { useCallback, useEffect, useState } from "react";
import { clockTime, dayLabel } from "@/lib/format";

type Recent = { id: number; work_date: string; clock_in: string | null; clock_out: string | null };
type Request = {
  id: number;
  attendance_id: number | null;
  requested_change: Record<string, string>;
  reason: string;
  status: string;
  review_note: string | null;
  created_at: string;
};

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  info_requested: "bg-blue-100 text-blue-700",
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MyCorrections() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/me/corrections", { cache: "no-store" });
    const d = await res.json();
    setRequests(d.requests ?? []);
    setRecent(d.recent ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Corrections</h1>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Request a correction
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Ask a manager to fix a clock-in or clock-out time on one of your days.</p>

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
                  {r.requested_change.clock_in && `In → ${new Date(r.requested_change.clock_in).toLocaleString("en-GB")}`}
                  {r.requested_change.clock_in && r.requested_change.clock_out && " · "}
                  {r.requested_change.clock_out && `Out → ${new Date(r.requested_change.clock_out).toLocaleString("en-GB")}`}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status] ?? "bg-neutral-100"}`}>{r.status}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">&ldquo;{r.reason}&rdquo;</p>
              {r.review_note && <p className="mt-1 text-xs text-neutral-500">Manager: {r.review_note}</p>}
              <p className="mt-1 text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString("en-GB")}</p>
            </div>
          ))}
        </div>
      )}

      {open && <RequestModal recent={recent} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function RequestModal({ recent, onClose, onDone }: { recent: Recent[]; onClose: () => void; onDone: () => void }) {
  const [attId, setAttId] = useState("");
  const [fixIn, setFixIn] = useState(false);
  const [fixOut, setFixOut] = useState(false);
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const row = recent.find((r) => String(r.id) === attId);

  function pick(id: string) {
    setAttId(id);
    const r = recent.find((x) => String(x.id) === id);
    setClockIn(toLocalInput(r?.clock_in ?? null));
    setClockOut(toLocalInput(r?.clock_out ?? null));
    setFixIn(false);
    setFixOut(false);
  }

  async function submit() {
    if (!attId) return setErr("Pick a day");
    if (!fixIn && !fixOut) return setErr("Tick what's wrong");
    if (!reason.trim()) return setErr("Add a reason");
    setBusy(true);
    setErr("");
    const res = await fetch("/api/me/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendance_id: Number(attId),
        clock_in: fixIn && clockIn ? new Date(clockIn).toISOString() : undefined,
        clock_out: fixOut && clockOut ? new Date(clockOut).toISOString() : undefined,
        reason: reason.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Failed");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="font-semibold">Request a correction</h2>

        <label className="mt-4 block text-xs text-neutral-500">Which day?</label>
        <select value={attId} onChange={(e) => pick(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="">Pick a day…</option>
          {recent.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id === -1
                ? `${dayLabel(r.work_date)} — not clocked in yet`
                : `${dayLabel(r.work_date)} — in ${clockTime(r.clock_in)}, out ${r.clock_out ? clockTime(r.clock_out) : "—"}`}
            </option>
          ))}
        </select>

        {row && (
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={fixIn} onChange={(e) => setFixIn(e.target.checked)} />
              Clock-in time is wrong
            </label>
            {fixIn && (
              <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={fixOut} onChange={(e) => setFixOut(e.target.checked)} />
              Clock-out time is wrong / missing
            </label>
            {fixOut && (
              <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            )}
          </div>
        )}

        <label className="mt-3 block text-xs text-neutral-500">Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="e.g. forgot to clock out, left at 5:30" />

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
