// One design for every "can't show this" page in the Attendance app (same as the POS's) — no access,
// page not found, something went wrong — and the loading screen: the
// business's logo (/brand-logo), its name, a short message and buttons, on
// the cream background. The offline page (public/offline.html) copies it.

export type StatusAction = { label: string; href?: string; onClick?: () => void; primary?: boolean };

export function BrandLogo({ size = 88 }: { size?: number }) {
  // A background picture, not <img>: a business with no logo yet gets a 404
  // from /brand-logo and this simply stays empty (no broken-picture icon,
  // and never another business's logo).
  return <div aria-hidden className="rounded-[22%] bg-cover bg-center bg-no-repeat" style={{ width: size, height: size, backgroundImage: "url(/brand-logo?v=2)" }} />;
}

export default function StatusPage({ icon, title, lines = [], actions = [], name, note, digest }: {
  icon?: string;
  title: string;
  lines?: string[];
  actions?: StatusAction[];
  /** The business's name under the logo, when known. */
  name?: string | null;
  note?: string;
  digest?: string;
}) {
  const btn = (a: StatusAction) => `rounded-xl px-4 py-3 text-sm font-semibold text-center ${a.primary ? "bg-[#E34435] text-white" : "border border-[#D8CFBD] bg-white text-[#201B18]"}`;
  return (
    <div className="grid min-h-[70vh] place-items-center bg-[#FAF7F2] px-6 py-12 text-center">
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><BrandLogo /></div>
        {name && <p style={{ fontFamily: "var(--font-space-grotesk)" }} className="mt-3 text-[15px] font-semibold text-[#201B18]">{name}</p>}
        <h1 style={{ fontFamily: "var(--font-space-grotesk)" }} className="mt-6 text-[22px] font-semibold tracking-[-0.01em] text-[#201B18]">
          {icon && <span className="mr-1.5" aria-hidden>{icon}</span>}{title}
        </h1>
        {lines.map((l) => <p key={l} className="mt-2 text-[14px] text-[#6B625B]">{l}</p>)}
        {actions.length > 0 && (
          <div className={`mt-6 grid gap-2 ${actions.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {actions.map((a) => a.href
              ? <a key={a.label} href={a.href} className={btn(a)}>{a.label}</a>
              : <button key={a.label} type="button" onClick={a.onClick} className={btn(a)}>{a.label}</button>)}
          </div>
        )}
        {note && <p className="mt-6 text-xs text-[#7C716A]">{note}</p>}
        {digest && <p className="mt-3 text-[11px] text-[#7C716A]">Error code: {digest}</p>}
      </div>
    </div>
  );
}

/** The loading screen: logo, name and a moving bar (app/me/loading.tsx, app/admin/loading.tsx). */
export function LoadingScreen({ name }: { name?: string | null }) {
  return (
    <div className="grid min-h-[70vh] place-items-center bg-[#FAF7F2] px-6 text-center" role="status" aria-live="polite">
      <div>
        <div className="flex justify-center"><BrandLogo /></div>
        {name && <p style={{ fontFamily: "var(--font-space-grotesk)" }} className="mt-3 text-[15px] font-semibold text-[#201B18]">{name}</p>}
        <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-[#EDE7DA]">
          <div className="h-full w-1/3 rounded-full bg-[#E34435] motion-safe:animate-[hub-load_1.1s_ease-in-out_infinite]" />
        </div>
        <p className="mt-3 text-[13px] text-[#6B625B]">Loading…</p>
      </div>
    </div>
  );
}

/** A small moving bar for a list that's still loading inside a page. */
export function InlineLoading() {
  return (
    <div className="my-8 flex flex-col items-center" role="status" aria-live="polite">
      <div className="h-1 w-32 overflow-hidden rounded-full bg-[#EDE7DA]">
        <div className="h-full w-1/3 rounded-full bg-[#E34435] motion-safe:animate-[hub-load_1.1s_ease-in-out_infinite]" />
      </div>
      <p className="mt-2 text-xs text-[#6B625B]">Loading…</p>
    </div>
  );
}
