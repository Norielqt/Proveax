export default function Placeholder({ title, description }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-[#111] leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-[#888]">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-black/[0.06] bg-white p-12 text-center">
        <p className="text-sm font-medium text-[#888]">Coming in the next sprint.</p>
        <p className="mt-1 text-xs text-[#aaa]">This section is scaffolded but not yet implemented.</p>
      </div>
    </div>
  );
}
