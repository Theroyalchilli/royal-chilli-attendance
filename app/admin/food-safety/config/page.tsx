"use client";

import { useCallback, useEffect, useState } from "react";

type CheckType = { id: number; check_window: string; label: string; rule_text: string | null; requires_photo: boolean; active: boolean; display_order: number };
type TempType = { id: number; label: string; unit: string; kind: "max" | "min"; limit_value: number; rule_text: string | null; active: boolean; display_order: number };
type Course = { id: number; name: string; refresh_months: number; has_level: boolean; active: boolean };

const WINDOWS = ["opening", "service", "closing", "weekly"] as const;

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
      <p className="text-xs text-neutral-400">{subtitle}</p>
    </div>
  );
}

export default function FoodSafetyConfigPage() {
  const [checks, setChecks] = useState<CheckType[] | null>(null);
  const [temps, setTemps] = useState<TempType[] | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, t, co] = await Promise.all([
      fetch("/api/food-safety/config/checks", { cache: "no-store" }),
      fetch("/api/food-safety/config/temps", { cache: "no-store" }),
      fetch("/api/food-safety/config/courses", { cache: "no-store" }),
    ]);
    if (c.ok) setChecks((await c.json()).check_types);
    if (t.ok) setTemps((await t.json()).temp_types);
    if (co.ok) setCourses((await co.json()).courses);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(kind: "checks" | "temps" | "courses", id: number, active: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/food-safety/config/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error || "Failed to update"); return; }
    load();
  }

  // --- New check form ---
  const [newCheck, setNewCheck] = useState({ check_window: "opening", label: "", rule_text: "" });
  async function addCheck() {
    if (!newCheck.label.trim()) { setError("Enter a label"); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/food-safety/config/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCheck),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error || "Failed to add check"); return; }
    setNewCheck({ check_window: "opening", label: "", rule_text: "" });
    load();
  }

  // --- New temp form ---
  const [newTemp, setNewTemp] = useState({ label: "", kind: "max" as "max" | "min", limit_value: "", rule_text: "" });
  async function addTemp() {
    const limit = parseFloat(newTemp.limit_value);
    if (!newTemp.label.trim() || isNaN(limit)) { setError("Enter a label and a numeric limit"); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/food-safety/config/temps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newTemp.label, kind: newTemp.kind, limit_value: limit, rule_text: newTemp.rule_text }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error || "Failed to add temp check"); return; }
    setNewTemp({ label: "", kind: "max", limit_value: "", rule_text: "" });
    load();
  }

  // --- New course form ---
  const [newCourse, setNewCourse] = useState({ name: "", refresh_months: "36", has_level: false });
  async function addCourse() {
    if (!newCourse.name.trim()) { setError("Enter a course name"); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/food-safety/config/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCourse.name, refresh_months: Number(newCourse.refresh_months) || 0, has_level: newCourse.has_level }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error || "Failed to add course"); return; }
    setNewCourse({ name: "", refresh_months: "36", has_level: false });
    load();
  }

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <h1 className="text-lg font-semibold">Food Safety — Config</h1>
      <p className="mt-1 text-sm text-neutral-500">Manage the checks, temperature rules and training courses everyone else logs against. Retiring something never touches its history.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* Checks */}
      <SectionHeader title="Checks" subtitle="Opening, service, closing and weekly checklist items" />
      {checks === null ? <p className="mt-2 text-sm text-neutral-400">Loading…</p> : (
        <div className="mt-2 space-y-1.5">
          {checks.map((c) => (
            <div key={c.id} className={`flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 ${!c.active ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium text-neutral-800">{c.label}</p>
                <p className="text-xs text-neutral-400 capitalize">{c.check_window}{c.rule_text ? ` · ${c.rule_text}` : ""}</p>
              </div>
              <button disabled={busy} onClick={() => toggleActive("checks", c.id, !c.active)} className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-red-600">
                {c.active ? "Retire" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 rounded-xl border border-dashed border-neutral-300 bg-white p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <select value={newCheck.check_window} onChange={(e) => setNewCheck((f) => ({ ...f, check_window: e.target.value }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm capitalize">
            {WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <input value={newCheck.label} onChange={(e) => setNewCheck((f) => ({ ...f, label: e.target.value }))} placeholder="Check label" className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
          <input value={newCheck.rule_text} onChange={(e) => setNewCheck((f) => ({ ...f, rule_text: e.target.value }))} placeholder="Rule text (optional)" className="col-span-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
        </div>
        <button disabled={busy} onClick={addCheck} className="mt-2 w-full rounded-lg bg-neutral-800 py-2 text-sm font-semibold text-white disabled:opacity-50">+ Add check</button>
      </div>

      {/* Temps */}
      <SectionHeader title="Temperature checks" subtitle="Fridge, freezer, hot-hold and cooking rules" />
      {temps === null ? <p className="mt-2 text-sm text-neutral-400">Loading…</p> : (
        <div className="mt-2 space-y-1.5">
          {temps.map((t) => (
            <div key={t.id} className={`flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 ${!t.active ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium text-neutral-800">{t.label}</p>
                <p className="text-xs text-neutral-400">{t.kind === "max" ? "≤" : "≥"} {t.limit_value}{t.unit}</p>
              </div>
              <button disabled={busy} onClick={() => toggleActive("temps", t.id, !t.active)} className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-red-600">
                {t.active ? "Retire" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 rounded-xl border border-dashed border-neutral-300 bg-white p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <input value={newTemp.label} onChange={(e) => setNewTemp((f) => ({ ...f, label: e.target.value }))} placeholder="Label (e.g. Walk-in fridge)" className="col-span-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
          <select value={newTemp.kind} onChange={(e) => setNewTemp((f) => ({ ...f, kind: e.target.value as "max" | "min" }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm">
            <option value="max">Must be at/below (max)</option>
            <option value="min">Must be at/above (min)</option>
          </select>
          <input type="number" step="0.1" value={newTemp.limit_value} onChange={(e) => setNewTemp((f) => ({ ...f, limit_value: e.target.value }))} placeholder="Limit °C" className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
          <input value={newTemp.rule_text} onChange={(e) => setNewTemp((f) => ({ ...f, rule_text: e.target.value }))} placeholder="Rule text (optional)" className="col-span-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
        </div>
        <button disabled={busy} onClick={addTemp} className="mt-2 w-full rounded-lg bg-neutral-800 py-2 text-sm font-semibold text-white disabled:opacity-50">+ Add temperature check</button>
      </div>

      {/* Courses */}
      <SectionHeader title="Training courses" subtitle="What staff can be trained on, and how often it needs refreshing" />
      {courses === null ? <p className="mt-2 text-sm text-neutral-400">Loading…</p> : (
        <div className="mt-2 space-y-1.5">
          {courses.map((c) => (
            <div key={c.id} className={`flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 ${!c.active ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium text-neutral-800">{c.name}</p>
                <p className="text-xs text-neutral-400">{c.refresh_months ? `Refresh every ${c.refresh_months} months` : "One-off, never expires"}{c.has_level ? " · has a level" : ""}</p>
              </div>
              <button disabled={busy} onClick={() => toggleActive("courses", c.id, !c.active)} className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-red-600">
                {c.active ? "Retire" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 rounded-xl border border-dashed border-neutral-300 bg-white p-3.5">
        <input value={newCourse.name} onChange={(e) => setNewCourse((f) => ({ ...f, name: e.target.value }))} placeholder="Course name" className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input type="number" value={newCourse.refresh_months} onChange={(e) => setNewCourse((f) => ({ ...f, refresh_months: e.target.value }))} placeholder="Refresh months (0 = never)" className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
          <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm text-neutral-600">
            <input type="checkbox" checked={newCourse.has_level} onChange={(e) => setNewCourse((f) => ({ ...f, has_level: e.target.checked }))} />
            Has a level (e.g. 1/2/3)
          </label>
        </div>
        <button disabled={busy} onClick={addCourse} className="mt-2 w-full rounded-lg bg-neutral-800 py-2 text-sm font-semibold text-white disabled:opacity-50">+ Add course</button>
      </div>
    </div>
  );
}
