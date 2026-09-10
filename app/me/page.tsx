import { getSession } from "@/lib/auth";

export default async function MeDashboard() {
  const session = await getSession();
  return (
    <div>
      <h1 className="text-2xl font-bold">Hi {session?.name?.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-neutral-500">Your rota, hours, corrections and payslips.</p>
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        Your personal cards land in redesign step (c). Clock in and out at the reception tablet.
      </div>
    </div>
  );
}
