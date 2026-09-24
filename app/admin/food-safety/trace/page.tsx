"use client";

import { useCallback, useEffect, useState } from "react";

type Supplier = { id: number; name: string; contact_name: string | null; phone: string | null; approved: boolean; docs_status: string | null };
type Delivery = {
  id: number; item: string; temp_value: number | null; accepted: boolean; corrective_action: string | null; created_at: string;
  supplier: { name: string } | null; staff: { name: string } | null;
};

const timeOf = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function TracePage() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", item: "", temp_value: "", accepted: true, corrective_action: "" });

  const load = useCallback(async () => {
    const [sRes, dRes] = await Promise.all([
      fetch("/api/food-safety/suppliers", { cache: "no-store" }),
      fetch("/api/food-safety/deliveries", { cache: "no-store" }),
    ]);
    if (sRes.ok) setSuppliers((await sRes.json()).suppliers ?? []);
    if (dRes.ok) {
      const d = await dRes.json();
      setDeliveries(d.deliveries ?? []);
      setCanEdit(!!d.can_log);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleApproved(s: Supplier) {
    setBusy(true);
    await fetch(`/api/food-safety/suppliers/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !s.approved }),
    });
    setBusy(false);
    load();
  }

  async function submitDelivery() {
    if (!form.supplier_id || !form.item.trim()) { setError("Pick a supplier and item"); return; }
    if (!form.accepted && !form.corrective_action.trim()) { setError("A corrective action is required when refusing a delivery"); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/food-safety/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_id: Number(form.supplier_id),
        item: form.item,
        temp_value: form.temp_value ? parseFloat(form.temp_value) : undefined,
        accepted: form.accepted,
        corrective_action: form.corrective_action,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Failed to save"); return; }
    setForm({ supplier_id: "", item: "", temp_value: "", accepted: true, corrective_action: "" });
    setShowForm(false);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Food Safety — Trace</h1>
      <p className="mt-1 text-sm text-neutral-500">Approved suppliers and delivery checks.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">Suppliers</h2>
      {suppliers === null ? (
        <p className="mt-2 text-sm text-neutral-400">Loading…</p>
      ) : suppliers.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No suppliers yet — add them from the POS&apos;s Inventory section first.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="font-medium text-neutral-800">{s.name}</p>
                {s.docs_status && <p className="text-xs text-neutral-400">{s.docs_status}</p>}
              </div>
              {canEdit ? (
                <button
                  disabled={busy}
                  onClick={() => toggleApproved(s)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.approved ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                >
                  {s.approved ? "✓ Approved" : "Not approved"}
                </button>
              ) : (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.approved ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {s.approved ? "Approved" : "Not approved"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Deliveries</h2>
        {canEdit && !showForm && (
          <button onClick={() => setShowForm(true)} className="text-xs font-semibold text-brand">+ Log delivery</button>
        )}
      </div>

      {showForm && (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-3.5">
          <select
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          >
            <option value="">Supplier…</option>
            {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{!s.approved ? " (not approved)" : ""}</option>)}
          </select>
          <input
            value={form.item}
            onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
            placeholder="What was delivered?"
            className="mt-2 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              step="0.1"
              value={form.temp_value}
              onChange={(e) => setForm((f) => ({ ...f, temp_value: e.target.value }))}
              placeholder="Temp °C (optional)"
              className="w-32 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            />
            <div className="flex flex-1 overflow-hidden rounded-lg border border-neutral-200">
              <button
                onClick={() => setForm((f) => ({ ...f, accepted: true }))}
                className={`flex-1 py-1.5 text-xs font-semibold ${form.accepted ? "bg-emerald-600 text-white" : "text-neutral-500"}`}
              >
                Accepted
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, accepted: false }))}
                className={`flex-1 py-1.5 text-xs font-semibold ${!form.accepted ? "bg-red-600 text-white" : "text-neutral-500"}`}
              >
                Refused
              </button>
            </div>
          </div>
          {!form.accepted && (
            <textarea
              value={form.corrective_action}
              onChange={(e) => setForm((f) => ({ ...f, corrective_action: e.target.value }))}
              placeholder="Why refused, and what happened next?"
              rows={2}
              className="mt-2 w-full rounded-lg border border-neutral-200 p-2 text-sm"
            />
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-500">Cancel</button>
            <button disabled={busy} onClick={submitDelivery} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Save</button>
          </div>
        </div>
      )}

      {deliveries === null ? (
        <p className="mt-2 text-sm text-neutral-400">Loading…</p>
      ) : deliveries.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">Nothing logged yet.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {deliveries.map((d) => (
            <div key={d.id} className="rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-neutral-800">{d.item} <span className="font-normal text-neutral-400">· {d.supplier?.name ?? "Unknown supplier"}</span></p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.accepted ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {d.accepted ? "Accepted" : "Refused"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-400">
                {d.temp_value != null && `${d.temp_value}°C · `}{d.staff?.name ?? "Someone"} · {timeOf(d.created_at)}
              </p>
              {d.corrective_action && <p className="mt-1 text-xs text-neutral-500">{d.corrective_action}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
