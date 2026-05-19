

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
        <p className="text-[#888]">No properties match your filters.</p>
      </div>
    );
  }

  const allSelected = selectable && properties.length > 0 && properties.every((p) => selected?.has(propertyKey(p)));
  const someSelected = selectable && !allSelected && properties.some((p) => selected?.has(propertyKey(p)));

  return (
    <>
      {/* Select-all header — only shown when checkboxes are enabled */}
      {selectable && (
        <div className="flex items-center gap-2 border-b border-black/[0.06] bg-[#fafaf8] px-4 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={() => onToggleAll(properties)}
            className="h-3.5 w-3.5 rounded border-black/[0.1] accent-blue-600 cursor-pointer"
          />
          <span className="text-xs text-[#888]">
            {selected?.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      <ul className="divide-y divide-black/[0.06]">
        {properties.map((p) => {
          const key        = propertyKey(p);
          const id         = p.attom_id ?? p.id;
          const value      = formatValue(p.last_sale_price);
          const sqft       = p.square_feet ? Number(p.square_feet).toLocaleString() : null;
          const type       = formatType(p.property_type);
          const isSelected = selectable && selected?.has(key);

          return (
            <li
              key={key}
              onMouseEnter={() => onHover?.(id)}
              onMouseLeave={() => onHover?.(null)}
              className={isSelected ? 'bg-[#f4f1eb]/60' : ''}
            >
              <div className="flex items-stretch w-full">
                {/* Checkbox column */}
                {selectable && (
                  <label
                    className="flex items-center justify-center px-4 cursor-pointer hover:bg-[#f4f1eb]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(key)}
                      className="h-4 w-4 rounded border-black/[0.1] accent-blue-600 cursor-pointer"
                    />
                  </label>
                )}

                {/* Property row */}
                <button
                  onClick={() => onSelect?.(p)}
                  className="flex-1 flex items-start justify-between gap-3 px-4 py-4 hover:bg-[#fafaf8] transition-colors text-left min-w-0"
                >
                  {/* Left — address block */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111]">{p.street || p.address}</p>
                    <p className="truncate text-xs text-[#888] mt-1">
                      {p.city}, {p.state} {p.zip}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#aaa]">
                      {sqft  && <span>{sqft} sqft</span>}
                      {type  && <><span className="text-[#ddd]">·</span><span>{type}</span></>}
                    </div>
                  </div>

                  {/* Right — value block */}
                  <div className="shrink-0 text-right">
                    {value
                      ? <>
                          <p className="text-sm font-semibold text-[#111]">{value}</p>
                          <p className="text-xs text-[#aaa] mt-0.5">Last sale price</p>
                        </>
                      : <p className="text-xs text-[#ddd]">—</p>
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
