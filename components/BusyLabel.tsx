import type { ReactNode } from "react";

// A small spinner that follows the text colour around it.
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-[spin_2s_linear_infinite] ${className}`}
    />
  );
}

// What goes inside a button that saves or sends something: its normal wording,
// or a spinner and what it's doing while it works. The button itself still
// sets disabled={busy}, so a second tap can't get through. hideText keeps a
// small button its size (screen readers still get the text).
export default function BusyLabel({ busy, text, hideText = false, children }: { busy: boolean; text: string; hideText?: boolean; children: ReactNode }) {
  if (!busy) return <>{children}</>;
  return (
    <span className="inline-flex items-center justify-center gap-2" role="status">
      <Spinner />
      <span className={hideText ? "sr-only" : undefined}>{text}</span>
    </span>
  );
}
