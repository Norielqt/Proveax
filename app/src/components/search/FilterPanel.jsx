export default function FilterPanel({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v || undefined });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900">Filters</h2>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
        <input value={value.q ?? ''} onChange={(e) => set('q', e.target.value)}
          placeholder="Address, city, owner…"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input placeholder="City" value={value.city ?? ''} onChange={(e) => set('city', e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <input placeholder="State" maxLength={2} value={value.state ?? ''}
          onChange={(e) => set('state', e.target.value.toUpperCase())}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
        <select value={value.property_type ?? ''} onChange={(e) => set('property_type', e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Any</option>
          <option value="single_family">Single Family</option>
          <option value="multi_family">Multi Family</option>
          <option value="condo">Condo</option>
          <option value="townhouse">Townhouse</option>
          <option value="land">Land</option>
          <option value="commercial">Commercial</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Beds min</label>
          <input type="number" value={value.beds_min ?? ''}
            onChange={(e) => set('beds_min', +e.target.value || undefined)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Baths min</label>
          <input type="number" step="0.5" value={value.baths_min ?? ''}
            onChange={(e) => set('baths_min', +e.target.value || undefined)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">SqFt min</label>
          <input type="number" value={value.sqft_min ?? ''}
            onChange={(e) => set('sqft_min', +e.target.value || undefined)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">SqFt max</label>
          <input type="number" value={value.sqft_max ?? ''}
            onChange={(e) => set('sqft_max', +e.target.value || undefined)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Value min</label>
          <input type="number" value={value.value_min ?? ''}
            onChange={(e) => set('value_min', +e.target.value || undefined)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Value max</label>
          <input type="number" value={value.value_max ?? ''}
            onChange={(e) => set('value_max', +e.target.value || undefined)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <button onClick={() => onChange({ per_page: value.per_page })}
        className="w-full py-2 text-sm text-gray-600 hover:text-gray-900">
        Clear all
      </button>
    </div>
  );
}
