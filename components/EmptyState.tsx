// "Nothing here yet" for a Staff Hub list or report — one look everywhere:
// a soft box with an icon and a short line (what to do next, if anything).
export default function EmptyState({ icon = "📭", children, className = "" }: { icon?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`my-3 rounded-xl border border-dashed border-[#D8CFBD] bg-[#FBF8F1] px-4 py-8 text-center ${className}`}>
      <div className="text-2xl" aria-hidden>{icon}</div>
      <p className="mt-2 text-sm text-[#6B625B]">{children}</p>
    </div>
  );
}
