

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
        <div className="flex items-center gap-2 border-b border-black/[0.06] bg-white px-4 py-2.5">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={() => onToggleAll(properties)}
            className="h-3.5 w-3.5 rounded border-black/[0.1] accent-[#111] cursor-pointer"
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#888]">
            {selected?.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      <ul className="divide-y divide-black/[0.05]">
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
              className={`transition-colors ${isSelected ? 'bg-[#f5f5f5]/70' : 'bg-transparent hover:bg-white'}`}
            >
              <div className="flex items-stretch w-full">
                {/* Checkbox column */}
                {selectable && (
                  <label
                    className="flex items-center justify-center px-3.5 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(key)}
                      className="h-4 w-4 rounded border-black/[0.1] accent-[#111] cursor-pointer"
                    />
                  </label>
                )}

                {/* Property row */}
                <button
                  onClick={() => onSelect?.(p)}
                  className="flex-1 flex items-start justify-between gap-3 px-4 py-3.5 text-left min-w-0"
                >
                  {/* Left — address block */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#1a1a1a] leading-snug">{p.street || p.address}</p>
                    <p className="truncate text-[11px] text-[#999] mt-0.5 font-medium">
                      {p.city}, {p.state} {p.zip}
                    </p>
                    {(sqft || type) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {sqft  && <span className="text-[11px] text-[#bbb]">{sqft} sqft</span>}
                        {sqft && type && <span className="text-[#ddd] text-[11px]">&middot;</span>}
                        {type  && <span className="text-[11px] text-[#bbb]">{type}</span>}
                      </div>
                    )}
                  </div>

                  {/* Right — value block */}
                  <div className="shrink-0 text-right">
                    {value
                      ? <>
                          <p className="text-[13px] font-bold text-[#1a1a1a] leading-snug">{value}</p>
                          <p className="text-[10px] text-[#bbb] mt-0.5 uppercase tracking-wide">Last sale</p>
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
