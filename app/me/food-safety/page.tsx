"use client";

import { useCallback, useEffect, useState } from "react";

type CheckType = { id: number; check_window: string; label: string; rule_text: string | null; display_order: number };
type TempType = { id: number; label: string; unit: string; kind: "max" | "min"; limit_value: number; rule_text: string | null };
type StaffRef = { name: string } | null;
type CheckLog = { id: number; check_type_id: number; ok: boolean; problem_note: string | null; created_at: string; staff: StaffRef };
type TempLog = { id: number; temp_type_id: number; value: number; pass: boolean; corrective_action: string | null; created_at: string; staff: StaffRef };
type Problem = { id: number; what: string; action: string; created_at: string; staff: StaffRef };
type Signoff = { id: number; created_at: string; staff: StaffRef } | null;

type FoodSafetyState = {
  today: string;
  permissions: { canLog: boolean; canSignoff: boolean };
  check_types: CheckType[];
  temp_types: TempType[];
  check_logs: CheckLog[];
  temp_logs: TempLog[];
  problems: Problem[];
  signoff: Signoff;
};

const WINDOW_ORDER = ["opening", "service", "closing", "weekly"] as const;
const WINDOW_LABEL: Record<string, string> = { opening: "Opening", service: "Service", closing: "Closing", weekly: "Weekly" };
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function FoodSafetyTasks() {
  const [state, setState] = useState<FoodSafetyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [flagging, setFlagging] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const [tempValue, setTempValue] = useState<Record<number, string>>({});
  const [tempCorrective, setTempCorrective] = useState<Record<number, string>>({});
  const [tempFailPending, setTempFailPending] = useState<number | null>(null);

  const [problemWhat, setProblemWhat] = useState("");
  const [problemAction, setProblemAction] = useState("");
  const [showProblemForm, setShowProblemForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/food-safety", { cache: "no-store" });
    if (res.ok) setState(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="mx-auto max-w-2xl"><p className="mt-8 text-sm text-neutral-400">Loading…</p></div>;
  if (!state) return <div className="mx-auto max-w-2xl"><p className="mt-8 text-sm text-neutral-400">Couldn&apos;t load today&apos;s checks.</p></div>;

  const { permissions, check_types, temp_types, check_logs, temp_logs, problems, signoff } = state;

  const latestCheck = new Map<number, CheckLog>();
  for (const log of check_logs) if (!latestCheck.has(log.check_type_id)) latestCheck.set(log.check_type_id, log);

  const tempsForType = (id: number) => temp_logs.filter((t) => t.temp_type_id === id);

  async function submitCheck(checkTypeId: number, ok: boolean, problemNote?: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/food-safety/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ check_type_id: checkTypeId, ok, problem_note: problemNote }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Failed to save"); return; }
    setFlagging(null);
    setNote("");
    load();
  }

  async function submitTemp(tempTypeId: number, correctiveAction?: string) {
    const raw = tempValue[tempTypeId];
    const value = parseFloat(raw);
    if (!raw || isNaN(value)) { setError("Enter a reading"); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/food-safety/temp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temp_type_id: tempTypeId, value, corrective_action: correctiveAction }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (data.error?.includes("corrective action")) { setTempFailPending(tempTypeId); return; }
      setError(data.error || "Failed to save");
      return;
    }
    setTempFailPending(null);
    setTempValue((v) => ({ ...v, [tempTypeId]: "" }));
    setTempCorrective((v) => ({ ...v, [tempTypeId]: "" }));
    load();
  }

  async function submitProblem() {
    if (!problemWhat.trim() || !problemAction.trim()) { setError("Fill in both fields"); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/food-safety/problem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ what: problemWhat, action: problemAction }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Failed to save"); return; }
    setProblemWhat("");
    setProblemAction("");
    setShowProblemForm(false);
    load();
  }

  async function submitSignoff() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/food-safety/signoff", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Failed to sign off"); return; }
    load();
  }

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <h1 className="text-2xl font-bold">Food Safety</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {permissions.canLog ? "Tick off today's checks — flag anything that isn't right." : "Viewing today's food safety record (read only)."}
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {WINDOW_ORDER.filter((w) => check_types.some((c) => c.check_window === w)).map((w) => (
        <div key={w} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{WINDOW_LABEL[w]}</h2>
          <div className="mt-2 space-y-2">
            {check_types.filter((c) => c.check_window === w).map((c) => {
              const log = latestCheck.get(c.id);
              return (
                <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-800">{c.label}</p>
                      {c.rule_text && <p className="mt-0.5 text-xs text-neutral-400">{c.rule_text}</p>}
                      {log && (
                        <p className={`mt-1.5 text-xs font-medium ${log.ok ? "text-emerald-600" : "text-red-600"}`}>
                          {log.ok ? "✓" : "⚠"} {log.ok ? "OK" : "Problem noted"} — {log.staff?.name ?? "Someone"} at {timeOf(log.created_at)}
                          {!log.ok && log.problem_note && <span className="block font-normal text-neutral-500">{log.problem_note}</span>}
                        </p>
                      )}
                    </div>
                    {permissions.canLog && flagging !== c.id && (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          disabled={busy}
                          onClick={() => submitCheck(c.id, true)}
                          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setFlagging(c.id)}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          Flag
                        </button>
                      </div>
                    )}
                  </div>
                  {flagging === c.id && (
                    <div className="mt-3 border-t border-neutral-100 pt-3">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What's wrong, and what did you do about it?"
                        rows={2}
                        className="w-full rounded-lg border border-neutral-200 p-2 text-sm"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => { setFlagging(null); setNote(""); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-500">
                          Cancel
                        </button>
                        <button
                          disabled={busy || !note.trim()}
                          onClick={() => submitCheck(c.id, false, note)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Save problem
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {temp_types.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Temperatures</h2>
          <div className="mt-2 space-y-2">
            {temp_types.map((t) => {
              const readings = tempsForType(t.id);
              return (
                <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-neutral-800">{t.label}</p>
                      <p className="text-xs text-neutral-400">{t.rule_text ?? `${t.kind === "max" ? "≤" : "≥"} ${t.limit_value}${t.unit}`}</p>
                    </div>
                    {permissions.canLog && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          value={tempValue[t.id] ?? ""}
                          onChange={(e) => setTempValue((v) => ({ ...v, [t.id]: e.target.value }))}
                          placeholder={t.unit}
                          className="w-16 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <button
                          disabled={busy}
                          onClick={() => submitTemp(t.id)}
                          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Log
                        </button>
                      </div>
                    )}
                  </div>
                  {tempFailPending === t.id && (
                    <div className="mt-3 border-t border-neutral-100 pt-3">
                      <p className="text-xs font-medium text-red-600">That's outside the safe range — what did you do?</p>
                      <textarea
                        value={tempCorrective[t.id] ?? ""}
                        onChange={(e) => setTempCorrective((v) => ({ ...v, [t.id]: e.target.value }))}
                        rows={2}
                        className="mt-1.5 w-full rounded-lg border border-neutral-200 p-2 text-sm"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => setTempFailPending(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-500">
                          Cancel
                        </button>
                        <button
                          disabled={busy || !(tempCorrective[t.id] ?? "").trim()}
                          onClick={() => submitTemp(t.id, tempCorrective[t.id])}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                  {readings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {readings.map((r) => (
                        <span
                          key={r.id}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
                        >
                          {r.value}{t.unit} · {timeOf(r.created_at)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Problems today</h2>
          {permissions.canLog && !showProblemForm && (
            <button onClick={() => setShowProblemForm(true)} className="text-xs font-semibold text-brand">+ Add</button>
          )}
        </div>
        {showProblemForm && (
          <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-3.5">
            <input
              value={problemWhat}
              onChange={(e) => setProblemWhat(e.target.value)}
              placeholder="What happened?"
              className="w-full rounded-lg border border-neutral-200 p-2 text-sm"
            />
            <textarea
              value={problemAction}
              onChange={(e) => setProblemAction(e.target.value)}
              placeholder="What did you do about it?"
              rows={2}
              className="mt-2 w-full rounded-lg border border-neutral-200 p-2 text-sm"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setShowProblemForm(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-500">Cancel</button>
              <button disabled={busy} onClick={submitProblem} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Save</button>
            </div>
          </div>
        )}
        {problems.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Nothing logged today.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {problems.map((p) => (
              <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                <p className="font-medium text-neutral-800">{p.what}</p>
                <p className="mt-0.5 text-sm text-neutral-500">{p.action}</p>
                <p className="mt-1 text-xs text-neutral-400">{p.staff?.name ?? "Someone"} at {timeOf(p.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Day sign-off</h2>
        {signoff ? (
          <p className="mt-2 text-sm text-emerald-700">✓ Signed off by {signoff.staff?.name ?? "a manager"} at {timeOf(signoff.created_at)}</p>
        ) : permissions.canSignoff ? (
          <>
            <p className="mt-1 text-sm text-neutral-500">Confirms today's checks were done and safe methods followed.</p>
            <button
              disabled={busy}
              onClick={submitSignoff}
              className="mt-3 w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Sign off today
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">Not yet signed off by a manager.</p>
        )}
      </div>
    </div>
  );
}
