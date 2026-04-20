

function formatValue(val) {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function formatType(raw) {
  if (!raw) return null;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ResultsList({ properties, onHover, onSelect }) {
  if (!properties.length) {
    return <div className="p-8 text-center text-gray-500">No properties match your filters.</div>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {properties.map((p) => {
        const key        = p.attom_id ?? p.id ?? `${p.lat},${p.lng}`;
        const id         = p.attom_id ?? p.id;
        const value      = formatValue(p.estimated_value);
        const sqft       = p.square_feet ? Number(p.square_feet).toLocaleString() : null;
        const type       = formatType(p.property_type);

        return (
          <li key={key} onMouseEnter={() => onHover?.(id)} onMouseLeave={() => onHover?.(null)}>
            <button
              onClick={() => onSelect?.(p)}
              className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              {/* Left — address block */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{p.street || p.address}</p>
                <p className="truncate text-xs text-gray-500 mt-0.5">
                  {p.city}, {p.state} {p.zip}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
                  {sqft  && <span>{sqft} sqft</span>}
                  {type  && <><span className="text-gray-300">·</span><span>{type}</span></>}
                </div>
              </div>

              {/* Right — value block */}
              <div className="shrink-0 text-right">
                {value
                  ? <>
                      <p className="text-sm font-semibold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Est. value</p>
                    </>
                  : <p className="text-xs text-gray-300">—</p>
                }
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
