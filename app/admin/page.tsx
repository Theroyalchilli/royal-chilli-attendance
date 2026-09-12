"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { hm } from "@/lib/format";
import { SHIFT_STATUS_BADGE, SHIFT_STATUS_LABEL, type ShiftStatus } from "@/lib/shift-status";

type Dash = {
  today: string;
  employees: number;
  todaysShifts: { staff_name: string; role: string; start: string; end: string; status: ShiftStatus }[];
  attendance: { total: number; present: number; late: number; absent: number; onLeave: number };
  corrections: { id: number; staff_name: string; date: string; issue: string; status: string }[];
  timesheetPreview: { staff_name: string; net_seconds: number; overtime_seconds: number }[];
  weekTotalSeconds: number;
  attendanceRate: { label: string; rate: number }[];
  stuck: { id: number; staff_name: string; clock_in: string }[];
};
const CORR_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};
const DONUT = [
  { key: "present", label: "Present", color: "#10b981" },
  { key: "absent", label: "Absent", color: "#ef4444" },
  { key: "late", label: "Late", color: "#f59e0b" },
  { key: "onLeave", label: "On Leave", color: "#8b5cf6" },
] as const;

function Card({ title, href, subtitle, children }: { title: string; href?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
        </div>
        {href && <Link href={href} className="text-xs font-medium text-brand hover:underline">View all →</Link>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const load = () => fetch("/api/admin/dashboard", { cache: "no-store" }).then((r) => r.json()).then(setD).catch(() => {});
    load();
    const a = setInterval(load, 30_000);
    const b = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  if (!d) return <p className="text-sm text-neutral-400">Loading…</p>;

  const a = d.attendance;
  const pct = (n: number) => (a.total ? Math.round((n / a.total) * 100) : 0);
  const donutData = DONUT.map((s) => ({ ...s, value: a[s.key] }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {new Date(d.today + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      {d.stuck.length > 0 && (
        <Link href="/admin/attendance" className="mt-4 block rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 hover:bg-amber-100">
          {d.stuck.length} still clocked in from a forgotten clock-out — {d.stuck.map((s) => s.staff_name).join(", ")} →
        </Link>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Rota */}
        <Card title="Rota" subtitle="Today's shifts" href="/admin/attendance">
          {d.todaysShifts.length === 0 ? (
            <p className="text-sm text-neutral-400">No shifts scheduled today.</p>
          ) : (
            <div className="space-y-2">
              {d.todaysShifts.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 flex-wrap text-sm">
                  <div className="min-w-0">
                    <span className="font-medium truncate">{s.staff_name}</span>
                    {s.role && <span className="ml-2 text-xs capitalize text-neutral-400">{s.role}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-neutral-500 whitespace-nowrap">{s.start} – {s.end}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${SHIFT_STATUS_BADGE[s.status] ?? "bg-neutral-100"}`}>{SHIFT_STATUS_LABEL[s.status] ?? s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Attendance */}
        <Card title="Attendance" subtitle="Today's overview" href="/admin/attendance">
          <div className="grid grid-cols-2 gap-2">
            {DONUT.map((s) => (
              <div key={s.key} className="rounded-lg p-2" style={{ background: `${s.color}14` }}>
                <div className="text-xl font-bold" style={{ color: s.color }}>{a[s.key]}</div>
                <div className="text-[11px] text-neutral-500">{s.label} · {pct(a[s.key])}%</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={34} outerRadius={50} paddingAngle={2} strokeWidth={0}>
                    {donutData.map((s) => <Cell key={s.key} fill={s.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-lg font-bold leading-none">{a.total}</div>
                  <div className="text-[9px] text-neutral-400">Staff</div>
                </div>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              {DONUT.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-neutral-500">{s.label}</span>
                  <span className="ml-auto font-medium">{a[s.key]}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Corrections */}
        <Card title="Corrections" subtitle="Waiting for review" href="/admin/corrections">
          {d.corrections.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing pending.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <tbody>
                  {d.corrections.map((c) => (
                    <tr key={c.id} className="border-b border-neutral-50 last:border-0">
                      <td className="py-1.5 font-medium max-w-[110px] truncate">{c.staff_name}</td>
                      <td className="py-1.5 text-neutral-500 whitespace-nowrap">{c.date && new Date(c.date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                      <td className="py-1.5 text-neutral-500 whitespace-nowrap">{c.issue}</td>
                      <td className="py-1.5 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CORR_BADGE[c.status] ?? "bg-neutral-100"}`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Timesheets */}
        <Card title="Timesheets" subtitle="This week so far" href="/admin/timesheets">
          {d.timesheetPreview.length === 0 ? (
            <p className="text-sm text-neutral-400">No hours yet this week.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <tbody>
                    {d.timesheetPreview.map((t, i) => (
                      <tr key={i} className="border-b border-neutral-50 last:border-0">
                        <td className="py-1.5 font-medium max-w-[140px] truncate">{t.staff_name}</td>
                        <td className="py-1.5 text-right text-neutral-500 whitespace-nowrap">{hm(t.net_seconds)}</td>
                        <td className="py-1.5 text-right text-xs text-amber-600 whitespace-nowrap">{t.overtime_seconds ? `+${hm(t.overtime_seconds)}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                <span className="text-neutral-500">Total this week</span>
                <span className="font-semibold">{hm(d.weekTotalSeconds)}</span>
              </div>
            </>
          )}
        </Card>

        {/* Reports */}
        <Card title="Reports" subtitle="Attendance rate — last 7 days" href="/admin/reports">
          <div className="h-40">
            <ResponsiveContainer>
              <LineChart data={d.attendanceRate} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#cbd5e1" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#cbd5e1" />
                <Tooltip formatter={(v) => [`${v}%`, "Rate"]} />
                <Line type="monotone" dataKey="rate" stroke="#c1272d" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Employees */}
        <Card title="Employees" subtitle="Your team">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{d.employees}</div>
              <div className="text-xs text-neutral-400">active</div>
            </div>
            <Link href="/admin/employees" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              Manage employees →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
