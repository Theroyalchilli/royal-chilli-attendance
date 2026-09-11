"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Employee = {
  id: number;
  name: string;
  role: string;
  employee_number: string | null;
  employment_type: string | null;
  pay_rate: number | null;
};

const ROLE_LABEL: Record<string, string> = { employee: "Employee", manager: "Manager", hr: "HR", admin: "Admin" };

export default function EmployeesPage() {
  const [q, setQ] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/employees${query ? `?q=${encodeURIComponent(query)}` : ""}`, { cache: "no-store" });
    const data = await res.json();
    setEmployees(data.employees ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Employees</h1>
      <p className="mt-1 text-sm text-neutral-500">Active staff. Pick someone to see their attendance, corrections and payroll.</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or employee number…"
        className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
      />

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : employees.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No one matches “{q}”.</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {employees.map((e) => (
            <Link
              key={e.id}
              href={`/admin/employees/${e.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 hover:border-brand"
            >
              <span>
                <span className="font-medium">{e.name}</span>
                <span className="ml-2 text-xs text-neutral-400">{ROLE_LABEL[e.role] ?? e.role}</span>
              </span>
              <span className="text-xs text-neutral-400">{e.employee_number ?? "—"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
