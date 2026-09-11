"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const dest = (role: string) => (role === "employee" ? "/me" : "/admin");

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) router.replace(dest(d.user.role));
      })
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.replace(dest(data.user.role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-lg">📋</span>
          <h1 className="text-lg font-semibold">Staff Attendance</h1>
        </div>
        <p className="mt-2 text-sm text-neutral-500">Sign in with your Royal Chilli username and password.</p>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect="off"
          className="mt-5 w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-brand"
          required
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-brand"
          required
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="mt-4 h-11 w-full rounded-xl bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs text-neutral-400">
          Clocking in or out? Use the reception tablet.
        </p>
      </form>
    </main>
  );
}
