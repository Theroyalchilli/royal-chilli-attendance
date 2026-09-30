"use client";

import { useEffect, useRef, useState } from "react";

// "Are you sure?" before anything is deleted or erased — one box for the
// whole app. Mount <ConfirmHost /> once (root layout), then anywhere:
//
//   if (!(await confirmDelete(`table ${t.table_number}`))) return;
//
// Self-contained (no UI-library imports) so the attendance app keeps an
// identical copy.

type Ask = {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
};

let show: ((a: Ask) => void) | null = null;

export function confirmDialog(opts: { title: string; message?: string; confirmLabel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const ask = {
      title: opts.title,
      message: opts.message ?? "This will be permanently deleted. Are you sure you want to proceed?",
      confirmLabel: opts.confirmLabel ?? "Yes, delete",
      resolve,
    };
    // Host not mounted (shouldn't happen) — fall back to the browser's own box.
    if (show) show(ask);
    else resolve(window.confirm(`${ask.title}\n\n${ask.message}`));
  });
}

/** Asks before deleting `what` (e.g. `"table 5"`, `"“Starters”"`). */
export function confirmDelete(what: string, message?: string): Promise<boolean> {
  return confirmDialog({ title: `Delete ${what}?`, message });
}

export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = (a) => setAsk(a);
    return () => { show = null; };
  }, []);

  const close = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  useEffect(() => {
    if (!ask) return;
    cancelRef.current?.focus(); // the safe choice has focus
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  if (!ask) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 text-left shadow-2xl"
      >
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-red-100 text-xl" aria-hidden>⚠️</div>
        <h2 id="confirm-title" className="text-base font-bold text-gray-900">{ask.title}</h2>
        <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-gray-600">{ask.message}</p>
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => close(false)}
            className="h-11 flex-1 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className="h-11 flex-1 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700"
          >
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
