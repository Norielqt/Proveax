

import emptyImg from '../../assets/Proveax_loading.png';

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

export function propertyKey(p) {
  return String(p.attom_id ?? p.id ?? `${p.lat},${p.lng}`);
}

export default function ResultsList({ properties, onHover, onSelect, selected, onToggle, onToggleAll }) {
  const selectable = !!onToggle;

  if (!properties.length) {
    return (
      <div className="flex flex-1 w-full flex-col items-center justify-center p-12 text-center">
        <img src={emptyImg} alt="" className="mb-3 w-[55%] opacity-40" />
        <p className="text-gray-500">No properties match your filters.</p>
      </div>
    );
  }

  const allSelected = selectable && properties.length > 0 && properties.every((p) => selected?.has(propertyKey(p)));
  const someSelected = selectable && !allSelected && properties.some((p) => selected?.has(propertyKey(p)));

  return (
    <>
      {/* Select-all header — only shown when checkboxes are enabled */}
      {selectable && (
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={() => onToggleAll(properties)}
            className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-600 cursor-pointer"
          />
          <span className="text-xs text-gray-500">
            {selected?.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {properties.map((p) => {
          const key        = propertyKey(p);
          const id         = p.attom_id ?? p.id;
          const value      = formatValue(p.estimated_value);
          const sqft       = p.square_feet ? Number(p.square_feet).toLocaleString() : null;
          const type       = formatType(p.property_type);
          const isSelected = selectable && selected?.has(key);

          return (
            <li
              key={key}
              onMouseEnter={() => onHover?.(id)}
              onMouseLeave={() => onHover?.(null)}
              className={isSelected ? 'bg-blue-50/60' : ''}
            >
              <div className="flex items-stretch w-full">
                {/* Checkbox column */}
                {selectable && (
                  <label
                    className="flex items-center justify-center px-4 cursor-pointer hover:bg-blue-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(key)}
                      className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                    />
                  </label>
                )}

                {/* Property row */}
                <button
                  onClick={() => onSelect?.(p)}
                  className="flex-1 flex items-start justify-between gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left min-w-0"
                >
                  {/* Left — address block */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{p.street || p.address}</p>
                    <p className="truncate text-xs text-gray-500 mt-1">
                      {p.city}, {p.state} {p.zip}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
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
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
