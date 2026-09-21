"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clockTime, dayLabel } from "@/lib/format";

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  info_requested: "bg-blue-100 text-blue-700",
};

export default function RequestsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("tab") === "leave" ? "leave" : "corrections";
  const [tab, setTab] = useState<"corrections" | "leave">(initial);

  function switchTab(t: "corrections" | "leave") {
    setTab(t);
    router.replace(`/me/requests?tab=${t}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Requests</h1>
      <p className="mt-1 text-sm text-neutral-500">Corrections to your hours, or time off — both need a manager's approval.</p>

      <div className="mt-4 flex rounded-xl bg-neutral-100 p-1">
        <button
          onClick={() => switchTab("corrections")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === "corrections" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}
        >
          Corrections
        </button>
        <button
          onClick={() => switchTab("leave")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === "leave" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}
        >
          Time Off
        </button>
      </div>

      <div className="mt-5">{tab === "corrections" ? <CorrectionsTab /> : <LeaveTab />}</div>
    </div>
  );
}

// ---------- Corrections ----------

type Recent = { id: number; work_date: string; clock_in: string | null; clock_out: string | null };
type CorrectionReq = {
  id: number;
  attendance_id: number | null;
  requested_change: Record<string, string>;
  reason: string;
  status: string;
  review_note: string | null;
  created_at: string;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function CorrectionsTab() {
  const [requests, setRequests] = useState<CorrectionReq[]>([]);
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
    <div>
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Request a correction
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No requests yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
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

      {open && <CorrectionModal recent={recent} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function CorrectionModal({ recent, onClose, onDone }: { recent: Recent[]; onClose: () => void; onDone: () => void }) {
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

// ---------- Time Off ----------

type LeaveReq = {
  id: number;
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

function LeaveTab() {
  const [requests, setRequests] = useState<LeaveReq[]>([]);
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
    <div>
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Request time off
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No requests yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
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

      {open && <LeaveModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function LeaveModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
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
