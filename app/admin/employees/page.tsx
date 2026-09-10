"use client";

import { useCallback, useEffect, useState } from "react";

type Staff = {
  id: number;
  name: string;
  role: string;
  employment_type: string | null;
  pay_rate: number | null;
  has_pin: boolean;
  rota_start: string | null;
  rota_end: string | null;
  rota_working_days: number[] | null;
  rota_break_minutes: number | null;
  rota_grace_minutes: number | null;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function EmployeesPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff", { cache: "no-store" });
    const data = await res.json();
    setStaff(data.staff ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-lg font-semibold">Employees</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Set each person&apos;s kiosk PIN and default rota. Full HR still lives in the POS Staff Hub.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-5 space-y-1.5">
          {staff.map((s) => (
            <button
              key={s.id}
              onClick={() => setEditing(s)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-left hover:border-neutral-300"
            >
              <span>
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-neutral-400">{s.role}</span>
              </span>
              <span className="flex items-center gap-3 text-xs">
                <span className={s.has_pin ? "text-emerald-600" : "text-neutral-400"}>
                  {s.has_pin ? "PIN set" : "no PIN"}
                </span>
                <span className="text-neutral-400">
                  {s.rota_start && s.rota_end ? `${s.rota_start.slice(0, 5)}–${s.rota_end.slice(0, 5)}` : "no rota"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {editing && <EditModal staff={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EditModal({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const [pin, setPin] = useState("");
  const [start, setStart] = useState(staff.rota_start?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(staff.rota_end?.slice(0, 5) ?? "");
  const [days, setDays] = useState<number[]>(staff.rota_working_days ?? [1, 2, 3, 4, 5]);
  const [breakMin, setBreakMin] = useState(String(staff.rota_break_minutes ?? 0));
  const [graceMin, setGraceMin] = useState(staff.rota_grace_minutes == null ? "" : String(staff.rota_grace_minutes));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (pin && !/^\d{4}$/.test(pin)) return setErr("PIN must be exactly 4 digits");
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/admin/staff/${staff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: pin || undefined,
        rota_start: start || null,
        rota_end: end || null,
        rota_working_days: days,
        rota_break_minutes: Number(breakMin) || 0,
        rota_grace_minutes: graceMin === "" ? null : Number(graceMin),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      setErr(d.error || "Save failed");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="font-semibold">{staff.name}</h2>

        <label className="mt-4 block text-xs text-neutral-500">Kiosk PIN (4 digits)</label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder={staff.has_pin ? "•••• (leave blank to keep)" : "set a PIN"}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Rota start</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Rota end</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <label className="mt-4 block text-xs text-neutral-500">Working days</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const iso = i + 1;
            const on = days.includes(iso);
            return (
              <button
                key={d}
                onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== iso) : [...cur, iso].sort()))}
                className={`rounded-lg border px-2.5 py-1 text-xs ${on ? "border-brand bg-brand/10 text-brand" : "border-neutral-300 text-neutral-500"}`}
              >
                {d}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Unpaid break (min)</label>
            <input type="number" min={0} value={breakMin} onChange={(e) => setBreakMin(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Grace (min, blank = default)</label>
            <input type="number" min={0} value={graceMin} onChange={(e) => setGraceMin(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-semibold hover:bg-neutral-200">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
