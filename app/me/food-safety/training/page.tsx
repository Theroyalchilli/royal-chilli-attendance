"use client";

import { useEffect, useState } from "react";

type Course = { id: number; name: string; refresh_months: number; has_level: boolean };
type TrainingRecord = { id: number; course_id: number; level: string | null; date_done: string; trainer: string | null; certificate_ref: string | null } | null;
type Item = { course: Course; record: TrainingRecord; status: "not_done" | "overdue" | "soon" | "valid"; due_date: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  not_done: { label: "Not done", cls: "bg-red-50 text-red-600" },
  overdue: { label: "Overdue", cls: "bg-red-50 text-red-600" },
  soon: { label: "Due soon", cls: "bg-amber-50 text-amber-700" },
  valid: { label: "Current", cls: "bg-emerald-50 text-emerald-700" },
};
const d = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function MyTraining() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/me/food-safety/training", { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => setItems(x.items ?? []));
  }, []);

  async function viewCertificate(recordId: number) {
    setViewingId(recordId);
    setError("");
    const res = await fetch(`/api/food-safety/training/${recordId}/file`);
    const data = await res.json();
    setViewingId(null);
    if (!res.ok) { setError(data.error || "Couldn't open certificate"); return; }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">My Training</h1>
      <p className="mt-1 text-sm text-neutral-500">Your food hygiene and allergen training record.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {items === null ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-5 space-y-2">
          {items.map(({ course, record, status, due_date }) => {
            const s = STATUS[status];
            return (
              <div key={course.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-800">
                      {course.name}{record?.level ? ` — ${record.level}` : ""}
                    </p>
                    {record ? (
                      <p className="mt-0.5 text-xs text-neutral-400">
                        Done {d(record.date_done)}{record.trainer ? ` · ${record.trainer}` : ""}
                        {due_date && ` · refresh by ${d(due_date)}`}
                        {record.certificate_ref && (
                          <button
                            onClick={() => viewCertificate(record.id)}
                            disabled={viewingId === record.id}
                            className="ml-2 font-semibold text-brand disabled:opacity-50"
                          >
                            {viewingId === record.id ? "Opening…" : "📎 Certificate"}
                          </button>
                        )}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-neutral-400">No record on file yet.</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-neutral-400">Due for a refresher, or something missing? Speak to a manager.</p>
    </div>
  );
}
