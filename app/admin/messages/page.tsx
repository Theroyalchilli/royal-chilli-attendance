"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmDelete } from "@/components/ui/confirm";

// Admin → Messages: write a message to staff and send it now or at a set time.
// It goes to their 🔔 bell and to phones with notifications on.

type Audience = "everyone" | "today" | "managers" | "people";
type Staff = { id: number; name: string; role: string };
type Message = {
  id: number;
  title: string;
  body: string;
  audience: Audience;
  staff_ids: number[] | null;
  send_at: string;
  sent_at: string | null;
  cancelled_at: string | null;
  recipients: number | null;
  phones: number | null;
  created_by_name: string | null;
  reads: { read: string[]; unread: string[] } | null;
};

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "All active staff" },
  { value: "today", label: "Working today", hint: "On today's rota or clocked in now" },
  { value: "managers", label: "Managers only", hint: "Managers, HR and admins" },
  { value: "people", label: "Choose people", hint: "Pick names below" },
];
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function MessagesPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [audience, setAudience] = useState<Audience>("everyone");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [later, setLater] = useState(false);
  const [sendAt, setSendAt] = useState("");
  const [preview, setPreview] = useState<{ people: number; phones: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/messages", { cache: "no-store" });
    if (res.status === 401) return setDenied(true);
    const d = await res.json();
    setStaff(d.staff ?? []);
    setMessages(d.messages ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // live "Goes to N people · M have phone alerts on"
  useEffect(() => {
    const ids = [...picked].join(",");
    const t = setTimeout(() => {
      fetch(`/api/admin/messages/preview?audience=${audience}&ids=${ids}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setPreview(d))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [audience, picked]);

  async function send() {
    setError("");
    setDone("");
    if (!title.trim() || !body.trim()) return setError("Add a title and a message");
    if (audience === "people" && picked.size === 0) return setError("Choose at least one person");
    if (later && !sendAt) return setError("Pick the date and time to send");
    setBusy(true);
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        audience,
        staff_ids: [...picked],
        send_at: later ? new Date(sendAt).toISOString() : undefined,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Couldn't send");
    setDone(
      d.scheduled
        ? `Scheduled for ${when(d.send_at)}. It goes out within 5 minutes of that time.`
        : `Sent to ${d.recipients} ${d.recipients === 1 ? "person" : "people"} · ${d.phones} phone notification${d.phones === 1 ? "" : "s"}.`,
    );
    setTitle("");
    setBody("");
    setLater(false);
    setSendAt("");
    load();
  }

  async function cancel(id: number) {
    if (!(await confirmDelete("this message"))) return;
    await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    load();
  }

  if (denied) return <p className="mx-auto max-w-3xl text-sm text-neutral-500">Only managers and admins can send messages.</p>;

  const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900";
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const scheduled = messages.filter((m) => !m.sent_at && !m.cancelled_at);
  const history = messages.filter((m) => m.sent_at || m.cancelled_at);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-lg font-semibold">Messages</h1>
      <p className="mt-1 text-sm text-neutral-500">Send a message to staff phones and their 🔔 bell, now or at a set time.</p>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">To</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              onClick={() => setAudience(a.value)}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${audience === a.value ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-neutral-200"}`}
            >
              <div className="font-semibold">{a.label}</div>
              <div className="text-[11px] text-neutral-500">{a.hint}</div>
            </button>
          ))}
        </div>

        {audience === "people" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {staff.map((s) => {
              const on = picked.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    const next = new Set(picked);
                    if (on) next.delete(s.id);
                    else next.add(s.id);
                    setPicked(next);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-brand text-white" : "bg-neutral-100 text-neutral-600"}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Title
          <input id="msg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Staff meeting tomorrow" className={input} />
        </label>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Message
          <textarea id="msg-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={3} placeholder="3pm before evening service — please be on time." className={input} />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={!later} onChange={() => setLater(false)} /> Send now
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={later} onChange={() => setLater(true)} /> Send later
          </label>
          {later && (
            <input id="msg-when" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
          )}
        </div>

        {preview && (
          <p className="mt-3 text-sm text-neutral-600">
            Goes to <b>{preview.people}</b> {preview.people === 1 ? "person" : "people"} · <b>{preview.phones}</b> {preview.phones === 1 ? "has" : "have"} phone alerts on
            {preview.people > preview.phones && <span className="text-neutral-400"> (the rest see it in the bell when they open the app)</span>}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {done && <p className="mt-2 text-sm font-medium text-emerald-700">✓ {done}</p>}

        <button onClick={send} disabled={busy} className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          {busy ? "Sending…" : later ? "Schedule message" : "Send now"}
        </button>
      </div>

      {scheduled.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Scheduled</h2>
          <div className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {scheduled.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold">{m.title}</div>
                  <div className="text-neutral-600">{m.body}</div>
                  <div className="mt-1 text-xs text-neutral-400">
                    {when(m.send_at)} · {m.audience === "people" ? (m.staff_ids ?? []).map((id) => nameOf.get(id) ?? "?").join(", ") : AUDIENCES.find((a) => a.value === m.audience)?.label}
                  </div>
                </div>
                <button onClick={() => cancel(m.id)} className="shrink-0 text-xs text-red-600 hover:underline">Cancel</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Sent messages</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Nothing sent yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {history.map((m) => (
              <div key={m.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{m.title}</div>
                  <div className="shrink-0 text-xs text-neutral-400">{m.cancelled_at ? "Cancelled" : when(m.sent_at!)}</div>
                </div>
                <div className="text-neutral-600">{m.body}</div>
                <div className="mt-1 text-xs text-neutral-400">
                  {m.audience === "people" ? (m.staff_ids ?? []).map((id) => nameOf.get(id) ?? "?").join(", ") : AUDIENCES.find((a) => a.value === m.audience)?.label}
                  {!m.cancelled_at && m.recipients != null && ` · ${m.recipients} people · ${m.phones ?? 0} phones`}
                  {m.created_by_name && ` · by ${m.created_by_name}`}
                </div>
                {m.reads && <ReadReceipts reads={m.reads} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// "Read by 6 of 9" — tap to see who hasn't read it yet.
function ReadReceipts({ reads }: { reads: { read: string[]; unread: string[] } }) {
  const [open, setOpen] = useState(false);
  const total = reads.read.length + reads.unread.length;
  if (total === 0) return null;
  const pct = Math.round((reads.read.length / total) * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <div className="h-2 w-full max-w-[180px] overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-brand hover:underline">
          Read by {reads.read.length} of {total} {reads.unread.length ? (open ? "▴" : "▾") : "✓"}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reads.unread.map((n, i) => (
            <span key={`u${i}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Not read: {n}</span>
          ))}
          {reads.read.map((n, i) => (
            <span key={`r${i}`} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{n}</span>
          ))}
        </div>
      )}
    </div>
  );
}
