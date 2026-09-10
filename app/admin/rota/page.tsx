export default function RotaPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Rota</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Week view, shift editing and copy-previous-week land in Phase 6. For now, set each person&apos;s
        default working pattern under <a href="/admin/employees" className="text-blue-600 hover:underline">Employees</a> —
        lateness on the dashboard and reports already use it.
      </p>
    </div>
  );
}
