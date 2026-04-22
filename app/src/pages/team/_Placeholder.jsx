export default function Placeholder({ title, description }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-sm font-medium text-gray-500">Coming in the next sprint.</p>
        <p className="mt-1 text-xs text-gray-400">This section is scaffolded but not yet implemented.</p>
      </div>
    </div>
  );
}
