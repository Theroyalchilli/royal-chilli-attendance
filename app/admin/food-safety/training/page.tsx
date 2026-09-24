"use client";

import { useCallback, useEffect, useState } from "react";

type Course = { id: number; name: string; refresh_months: number; has_level: boolean };
type TrainingRecord = { id: number; level: string | null; date_done: string; trainer: string | null; certificate_ref: string | null } | null;
type Item = { course: Course; record: TrainingRecord; status: "not_done" | "overdue" | "soon" | "valid"; due_date: string | null };
type Member = { staff: { id: number; name: string; role: string }; items: Item[] };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS: Record<string, { label: string; cls: string }> = {
  not_done: { label: "Not done", cls: "bg-red-50 text-red-600" },
  overdue: { label: "Overdue", cls: "bg-red-50 text-red-600" },
  soon: { label: "Due soon", cls: "bg-amber-50 text-amber-700" },
  valid: { label: "Current", cls: "bg-emerald-50 text-emerald-700" },
};
const d = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function TeamTrainingPage() {
  const [team, setTeam] = useState<Member[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [canRecord, setCanRecord] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [form, setForm] = useState<{ course_id: string; level: string; date_done: string; trainer: string }>({
    course_id: "", level: "", date_done: new Date().toISOString().slice(0, 10), trainer: "",
  });
  const [certificate, setCertificate] = useState<{ name: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState<number | null>(null);

  async function viewCertificate(recordId: number) {
    setViewingId(recordId);
    setError("");
    const res = await fetch(`/api/food-safety/training/${recordId}/file`);
    const data = await res.json();
    setViewingId(null);
    if (!res.ok) { setError(data.error || "Couldn't open certificate"); return; }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/food-safety/training", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setTeam(data.team ?? []);
      setCourses(data.courses ?? []);
      setCanRecord(!!data.can_record);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(staffId: number) {
    if (!form.course_id || !form.date_done) { setError("Pick a course and date"); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/food-safety/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: staffId, course_id: Number(form.course_id), level: form.level, date_done: form.date_done, trainer: form.trainer,
        certificate: certificate?.dataUrl,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Failed to save"); return; }
    setForm({ course_id: "", level: "", date_done: new Date().toISOString().slice(0, 10), trainer: "" });
    setCertificate(null);
    setOpen(null);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Food Safety — Training</h1>
      <p className="mt-1 text-sm text-neutral-500">Hygiene and allergen training status across the team.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {team === null ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 space-y-2">
          {team.map(({ staff, items }) => (
            <div key={staff.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
              <button onClick={() => setOpen(open === staff.id ? null : staff.id)} className="flex w-full items-center justify-between">
                <span className="font-medium">{staff.name}</span>
                <div className="flex gap-1">
                  {items.map((i) => (
                    <span key={i.course.id} className={`h-2 w-2 rounded-full ${i.status === "valid" ? "bg-emerald-500" : i.status === "soon" ? "bg-amber-500" : "bg-red-500"}`} title={`${i.course.name}: ${STATUS[i.status].label}`} />
                  ))}
                </div>
              </button>

              {open === staff.id && (
                <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                  {items.map(({ course, record, status, due_date }) => (
                    <div key={course.id} className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-medium text-neutral-700">{course.name}</span>
                        {record && <span className="ml-2 text-xs text-neutral-400">{d(record.date_done)}{due_date ? ` · refresh by ${d(due_date)}` : ""}</span>}
                        {record?.certificate_ref && (
                          <button
                            onClick={() => viewCertificate(record.id)}
                            disabled={viewingId === record.id}
                            className="ml-2 text-xs font-semibold text-brand disabled:opacity-50"
                          >
                            {viewingId === record.id ? "Opening…" : "📎 Certificate"}
                          </button>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[status].cls}`}>{STATUS[status].label}</span>
                    </div>
                  ))}

                  {canRecord && (
                    <div className="mt-3 rounded-lg bg-neutral-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Record training</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select
                          value={form.course_id}
                          onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))}
                          className="col-span-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                        >
                          <option value="">Course…</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {courses.find((c) => String(c.id) === form.course_id)?.has_level && (
                          <input
                            value={form.level}
                            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                            placeholder="Level (e.g. Level 2)"
                            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                          />
                        )}
                        <input
                          type="date"
                          value={form.date_done}
                          onChange={(e) => setForm((f) => ({ ...f, date_done: e.target.value }))}
                          className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <input
                          value={form.trainer}
                          onChange={(e) => setForm((f) => ({ ...f, trainer: e.target.value }))}
                          placeholder="Trainer (optional)"
                          className="col-span-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <label className="col-span-2 flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-neutral-300 px-2 py-1.5 text-xs text-neutral-500">
                          {certificate ? certificate.name : "Attach certificate (JPG, PNG or PDF, optional)"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 3_000_000) { setError("File is too large (max 3MB)"); return; }
                              setCertificate({ name: file.name, dataUrl: await readFileAsDataUrl(file) });
                            }}
                          />
                        </label>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => submit(staff.id)}
                        className="mt-2 w-full rounded-lg bg-neutral-800 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
