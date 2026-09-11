"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hm } from "@/lib/format";
import ClockButton from "@/components/me/ClockButton";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function thisWeek() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return {
    monday: mon.toISOString().slice(0, 10),
    from: mon.toISOString().slice(0, 10),
    to: sun.toISOString().slice(0, 10),
  };
}

type Card = { title: string; href: string; body: React.ReactNode };

export default function MeDashboard() {
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    const { monday, from, to } = thisWeek();
    (async () => {
      const [me, rota, att, corr, pay] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()).catch(() => null),
        fetch(`/api/me/rota?week_start=${monday}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/me/attendance?from=${from}&to=${to}`).then((r) => r.json()).catch(() => ({})),
        fetch("/api/me/corrections").then((r) => r.json()).catch(() => ({})),
        fetch("/api/me/payslips").then((r) => r.json()).catch(() => ({})),
      ]);
      setName(me?.user?.name?.split(" ")[0] ?? "");

      const todayIso = new Date().toISOString().slice(0, 10);
      const nextShift = (rota.shifts ?? [])
        .filter((s: { shift_date: string }) => s.shift_date >= todayIso)
        .sort((a: { shift_date: string }, b: { shift_date: string }) => a.shift_date.localeCompare(b.shift_date))[0];

      const pendingCorr = (corr.requests ?? []).filter((r: { status: string }) => r.status === "pending").length;
      const latest = (pay.payslips ?? [])[0];

      setCards([
        {
          title: "My Rota",
          href: "/me/rota",
          body: nextShift ? (
            <p className="text-sm">
              Next: <span className="font-semibold">{DOW[new Date(nextShift.shift_date + "T12:00:00Z").getUTCDay()]}</span>{" "}
              {nextShift.start_time.slice(0, 5)}–{nextShift.end_time.slice(0, 5)}
            </p>
          ) : (
            <p className="text-sm text-neutral-400">No upcoming shifts set</p>
          ),
        },
        {
          title: "My Hours",
          href: "/me/attendance",
          body: (
            <p className="text-sm">
              This week: <span className="font-semibold">{hm(att.totals?.net_seconds ?? 0)}</span> over {att.totals?.days_worked ?? 0} day(s)
            </p>
          ),
        },
        {
          title: "Corrections",
          href: "/me/corrections",
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
      <h1 className="text-2xl font-bold">Hi {name}</h1>
      <p className="mt-1 text-sm text-neutral-500">Clock in and out below, or at the reception tablet.</p>

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
