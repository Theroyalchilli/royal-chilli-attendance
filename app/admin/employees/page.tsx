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
  active: number;
};

const ROLE_LABEL: Record<string, string> = { employee: "Employee", manager: "Manager", hr: "HR", admin: "Admin" };

export default function EmployeesPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("1");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string, roleFilter: string, activeFilter: string) => {
    setLoading(true);
    const p = new URLSearchParams({ active: activeFilter });
    if (query) p.set("q", query);
    if (roleFilter) p.set("role", roleFilter);
    const res = await fetch(`/api/admin/employees?${p}`, { cache: "no-store" });
    const data = await res.json();
    setEmployees(data.employees ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, role, active), 250);
    return () => clearTimeout(t);
  }, [q, role, active, load]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Employees</h1>
      <p className="mt-1 text-sm text-neutral-500">Pick someone to see their attendance, corrections and payroll.</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or employee number…"
        className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
      />

      <div className="mt-2 flex gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="hr">HR</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </select>
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="1">Active</option>
          <option value="0">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-400">Loading…</p>
      ) : employees.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No one matches these filters.</p>
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
                {!e.active && (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">Inactive</span>
                )}
              </span>
              <span className="text-xs text-neutral-400">{e.employee_number ?? "—"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
