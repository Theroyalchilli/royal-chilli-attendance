"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { hm, decimalHours } from "@/lib/format";
import ClockButton from "@/components/me/ClockButton";

const DOW_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

const GREY = "#E4DFD3";
const PURPLE = "#8b5cf6";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function thisWeek() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const monday = mon.toISOString().slice(0, 10);
  return {
    monday,
    days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    from: monday,
    to: addDays(monday, 6),
  };
}

/** "HH:MM" or "HH:MM:SS" -> hours, rolling past midnight if end <= start. */
function shiftHours(start: string, end: string) {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let mins = toMin(end) - toMin(start);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

type Bar7 = { label: string; hours: number; tooltip: string; isToday: boolean; muted: boolean; color?: string };

function WeekGlance({ data, color }: { data: Bar7[]; color: string }) {
  return (
    <div className="h-20">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#a3a3a3" }} interval={0} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as Bar7;
              return (
                <div className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs shadow-sm">
                  {d.tooltip}
                </div>
              );
            }}
          />
          <Bar dataKey="hours" radius={[3, 3, 0, 0]} minPointSize={2} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.muted ? GREY : d.color ?? color}
                stroke={d.isToday ? "#201b18" : undefined}
                strokeWidth={d.isToday ? 1 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Card = { title: string; href: string; body: React.ReactNode };

export default function MeDashboard() {
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    const { monday, days, from, to } = thisWeek();
    const todayIso = new Date().toISOString().slice(0, 10);

    (async () => {
      const [me, rota, att, corr, pay] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()).catch(() => null),
        fetch(`/api/me/rota?week_start=${monday}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/me/attendance?from=${from}&to=${to}`).then((r) => r.json()).catch(() => ({})),
        fetch("/api/me/corrections").then((r) => r.json()).catch(() => ({})),
        fetch("/api/me/payslips").then((r) => r.json()).catch(() => ({})),
      ]);
      setName(me?.user?.name?.split(" ")[0] ?? "");

      const shiftsByDay = new Map<string, { start_time: string; end_time: string }[]>();
      for (const s of rota.shifts ?? []) {
        if (!shiftsByDay.has(s.shift_date)) shiftsByDay.set(s.shift_date, []);
        shiftsByDay.get(s.shift_date)!.push(s);
      }
      const leave = (rota.leave ?? []) as { start_date: string; end_date: string }[];
      const onLeave = (day: string) => leave.some((l) => day >= l.start_date && day <= l.end_date);

      const rotaData: Bar7[] = days.map((day, i) => {
        const shifts = shiftsByDay.get(day) ?? [];
        const hours = shifts.reduce((s, sh) => s + shiftHours(sh.start_time, sh.end_time), 0);
        const leaveDay = hours === 0 && onLeave(day);
        return {
          label: DOW_LETTER[i],
          hours,
          tooltip: shifts.length
            ? shifts.map((sh) => `${sh.start_time.slice(0, 5)}–${sh.end_time.slice(0, 5)}`).join(", ")
            : leaveDay
              ? "On leave"
              : "Off",
          isToday: day === todayIso,
          muted: hours === 0 && !leaveDay,
          color: leaveDay ? PURPLE : undefined,
        };
      });

      const netByDay = new Map<string, number>();
      for (const r of (att.rows ?? []) as { work_date: string; clock_out: string | null; net_work_seconds: number }[]) {
        if (!r.clock_out) continue;
        netByDay.set(r.work_date, (netByDay.get(r.work_date) ?? 0) + (r.net_work_seconds ?? 0));
      }
      const hoursData: Bar7[] = days.map((day, i) => {
        const seconds = netByDay.get(day) ?? 0;
        return {
          label: DOW_LETTER[i],
          hours: decimalHours(seconds),
          tooltip: seconds ? hm(seconds) : "No hours",
          isToday: day === todayIso,
          muted: seconds === 0,
        };
      });

      const pendingCorr = (corr.requests ?? []).filter((r: { status: string }) => r.status === "pending").length;
      const latest = (pay.payslips ?? [])[0];

      setCards([
        {
          title: "My Rota",
          href: "/me/rota",
          body: <WeekGlance data={rotaData} color="#E34435" />,
        },
        {
          title: "My Hours",
          href: "/me/attendance",
          body: (
            <>
              <WeekGlance data={hoursData} color="#10b981" />
              <p className="mt-1 text-sm">
                This week: <span className="font-semibold">{hm(att.totals?.net_seconds ?? 0)}</span> over {att.totals?.days_worked ?? 0} day(s)
              </p>
            </>
          ),
        },
        {
          title: "Corrections",
          href: "/me/requests?tab=corrections",
          body: <p className="text-sm">{pendingCorr > 0 ? `${pendingCorr} awaiting review` : "Nothing pending"}</p>,
        },
        {
          title: "Latest Payslip",
          href: "/me/payslips",
          body: latest ? (
            <p className="text-sm">
              £{latest.gross_pay.toFixed(2)} · <span className="text-neutral-500">{latest.status.replace("_", " ")}</span>
            </p>
          ) : (
            <p className="text-sm text-neutral-400">Nothing yet</p>
          ),
        },
      ]);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">{greeting()}{name ? `, ${name}` : ""} 🎉</h1>

      <div className="mt-5">
        <ClockButton />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(cards ?? Array.from({ length: 4 }, () => null)).map((c, i) => (
          <Link
            key={i}
            href={c?.href ?? "#"}
            className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-brand"
          >
            {c ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{c.title}</h2>
                  <span className="text-xs text-brand">View →</span>
                </div>
                <div className="mt-2">{c.body}</div>
              </>
            ) : (
              <div className="h-16 animate-pulse rounded bg-neutral-100" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
