import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rentcastSearch, rentcastLoadMore } from '../api/rentcast';
import { useSubscription } from '../hooks/useSubscription';
import ResultsList from '../components/search/ResultsList';
import ResultsMap  from '../components/search/ResultsMap';
import PropertyDetailModal from '../components/search/PropertyDetailModal';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

const TYPES = [
  { value: '',              label: 'All types' },
  { value: 'Single Family', label: 'Single Family' },
  { value: 'Multi-Family',  label: 'Multi-Family' },
  { value: 'Apartment',     label: 'Apartment' },
  { value: 'Condo',         label: 'Condo' },
  { value: 'Townhouse',     label: 'Townhouse' },
  { value: 'Manufactured',  label: 'Manufactured' },
  { value: 'Land',          label: 'Land' },
];

/**
 * Parse a free-text query into ATTOM search params.
 * Supports:
 *   "90210"                    → { postalcode: '90210' }
 *   "Brooklyn, NY"             → { city: 'Brooklyn', state: 'NY' }
 *   "Main St, Brooklyn NY 11201" → { postalcode: '11201' }  (ZIP wins when present)
 *   "Beverly Hills CA 90210"   → { postalcode: '90210' }
 * Returns null if the query can't be resolved.
 */
function parseQuery(raw) {
  const q = raw.trim();
  if (!q) return null;

  // Any 5-digit ZIP found anywhere → use it (most specific)
  const zipMatch = q.match(/\b(\d{5})\b/);
  if (zipMatch) return { postalcode: zipMatch[1] };

  // "City, ST" or "City ST" — 2-letter state code at the end
  const csMatch = q.match(/^(.+?),?\s+([A-Za-z]{2})\s*$/);
  if (csMatch) {
    return { city: csMatch[1].trim(), state: csMatch[2].toUpperCase() };
  }

  return null;
}

export default function Dashboard() {
  const sub = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();

  // Bootstrap filters from URL on first load
  const initFilters = () => {
    const raw = searchParams.get('filters');
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  };
  const [filters, setFilters] = useState(initFilters);

  // Advanced attribute filters (local state — committed via Apply button)
  const [advFilters, setAdvFilters] = useState(() => {
    const f = initFilters();
    return {
      bedroomsMin:  f.bedroomsMin  ?? '',
      bedroomsMax:  f.bedroomsMax  ?? '',
      bathroomsMin: f.bathroomsMin ?? '',
      bathroomsMax: f.bathroomsMax ?? '',
      sqftMin:      f.sqftMin      ?? '',
      sqftMax:      f.sqftMax      ?? '',
      yearBuiltMin: f.yearBuiltMin ?? '',
      yearBuiltMax: f.yearBuiltMax ?? '',
      lotSizeMin:   f.lotSizeMin   ?? '',
      lotSizeMax:   f.lotSizeMax   ?? '',
      ownerOccupied: f.ownerOccupied ?? '',
    };
  });
  // Ref so callbacks always see latest advFilters without needing it in dep arrays
  const advFiltersRef = useRef(advFilters);
  useEffect(() => { advFiltersRef.current = advFilters; }, [advFilters]);
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const activeAdvCount = Object.values(advFilters).filter(v => v !== '').length;

  // Reconstruct query text from filters for the input
  const filtersToQuery = (f) => {
    if (f.postalcode) return f.postalcode;
    if (f.city && f.state) return `${f.city}, ${f.state}`;
    return '';
  };
  const [queryText, setQueryText] = useState(() => filtersToQuery(initFilters()));
  const [parseError, setParseError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimerRef = useRef(null);
  const autoSearchTimerRef = useRef(null);
  const inputRef = useRef(null);

  const [results, setResults] = useState([]);
  const [attomTotal, setAttomTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const allResultsRef = useRef(new Map());
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const viewTimerRef   = useRef(null);
  const [manualSearchKey, setManualSearchKey] = useState(0);
  const [panSearchKey, setPanSearchKey] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);

  const applyFilters = useCallback((parsed, propertytype, ownerOccupiedOverride) => {
    const current = advFiltersRef.current;
    const adv = Object.fromEntries(
      Object.entries({
        ...current,
        ...(ownerOccupiedOverride !== undefined ? { ownerOccupied: ownerOccupiedOverride } : {}),
      }).filter(([, v]) => v !== '' && v != null)
    );
    const next = { ...parsed, ...(propertytype ? { propertytype } : {}), ...adv };
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== ''));
    const encoded = Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
    setSearchParams(encoded ? { filters: encoded } : {}, { replace: true });
    setFilters(clean);
  }, [setSearchParams]);

  const submitSearch = useCallback((text) => {
    const q = text ?? queryText;
    const parsed = parseQuery(q);
    if (!parsed) return;
    setParseError('');
    setSuggestions([]);
    setShowSuggestions(false);
    applyFilters(parsed, filters.propertytype);
  }, [queryText, filters.propertytype, applyFilters]);

  // Fetch geocoding suggestions from MapTiler
  const fetchSuggestions = useCallback((text) => {
    clearTimeout(suggestTimerRef.current);
    if (!text || text.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    suggestTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(text)}.json?key=${MAPTILER_KEY}&country=us&types=municipality,place,postal_code&limit=5`;
        const resp = await fetch(url);
        const json = await resp.json();
        const stateAbbr = {
          'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
          'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
          'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
          'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
          'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
          'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
          'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
          'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
          'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
          'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
          'District of Columbia':'DC',
        };
        const items = (json.features || []).map((f) => {
          const isZip = f.place_type?.[0] === 'postal_code';
          const region = f.context?.find((c) => c.id?.startsWith('region'));
          const st = region ? (stateAbbr[region.text] || region.text) : '';
          return {
            label: f.place_name,
            text: isZip ? f.text.split('-')[0] : (st ? `${f.text}, ${st}` : f.place_name),
          };
        });
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      } catch { /* ignore */ }
    }, 250);
  }, []);

  // Debounced auto-search when typing
  const handleInputChange = useCallback((text) => {
    setQueryText(text);
    setParseError('');
    fetchSuggestions(text);
    clearTimeout(autoSearchTimerRef.current);
    // Only auto-search for complete 5-digit ZIPs (instant gratification);
    // cities require picking a suggestion or pressing Enter.
    const isCompleteZip = /^\d{5}$/.test(text.trim());
    if (isCompleteZip) {
      autoSearchTimerRef.current = setTimeout(() => {
        setSuggestions([]);
        setShowSuggestions(false);
        const parsed = parseQuery(text);
        if (parsed) applyFilters(parsed, filters.propertytype);
      }, 600);
    }
  }, [filters.propertytype, applyFilters, fetchSuggestions]);

  // Pick a suggestion
  const pickSuggestion = useCallback((item) => {
    setQueryText(item.text);
    setSuggestions([]);
    setShowSuggestions(false);
    clearTimeout(autoSearchTimerRef.current);
    clearTimeout(suggestTimerRef.current);
    const parsed = parseQuery(item.text);
    if (parsed) applyFilters(parsed, filters.propertytype);
  }, [filters.propertytype, applyFilters]);

  const handleTypeChange = (v) => {
    // Re-apply current location filters with new type
    const locationFilters = {};
    if (filters.postalcode) locationFilters.postalcode = filters.postalcode;
    if (filters.city)       locationFilters.city = filters.city;
    if (filters.state)      locationFilters.state = filters.state;
    applyFilters(locationFilters, v);
  };

  const handleApplyAdv = useCallback(() => {
    const locationFilters = {};
    if (filters.postalcode) locationFilters.postalcode = filters.postalcode;
    if (filters.city)       locationFilters.city = filters.city;
    if (filters.state)      locationFilters.state = filters.state;
    applyFilters(locationFilters, filters.propertytype);
  }, [filters, applyFilters]);

  const handleClearAdv = useCallback(() => {
    const empty = {
      bedroomsMin: '', bedroomsMax: '',
      bathroomsMin: '', bathroomsMax: '',
      sqftMin: '', sqftMax: '',
      yearBuiltMin: '', yearBuiltMax: '',
      lotSizeMin: '', lotSizeMax: '',
      ownerOccupied: '',
    };
    setAdvFilters(empty);
    advFiltersRef.current = empty;
    const locationFilters = {};
    if (filters.postalcode) locationFilters.postalcode = filters.postalcode;
    if (filters.city)       locationFilters.city = filters.city;
    if (filters.state)      locationFilters.state = filters.state;
    applyFilters(locationFilters, filters.propertytype);
  }, [filters, applyFilters]);

  // Fired by map on pan/zoom
  const handleViewChange = useCallback(({ lat, lng, radius }) => {
    if (filters.postalcode || filters.city) return;
    clearTimeout(viewTimerRef.current);
    viewTimerRef.current = setTimeout(() => {
      setLoading(true);
      rentcastSearch({ latitude: lat, longitude: lng, radius, limit: 100 })
        .then((r) => {
          const fresh = r.data || [];
          allResultsRef.current.clear();
          fresh.forEach((p) => {
            const uid = String(p.attom_id ?? `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`);
            allResultsRef.current.set(uid, p);
          });
          setResults([...allResultsRef.current.values()]);
          setPanSearchKey((k) => k + 1);
          if (r.total) setAttomTotal(r.total);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
  }, [filters.postalcode, filters.city]);

  useEffect(() => {
    if (!filters.postalcode && (!filters.city || !filters.state)) {
      setResults([]);
      setAttomTotal(0);
      return;
    }
    setLoading(true);
    setHasMore(false);
    setManualSearchKey((k) => k + 1);
    allResultsRef.current.clear();
    rentcastSearch(filters)
      .then((r) => {
        const fresh = r.data || [];
        fresh.forEach((p) => {
          const uid = String(p.attom_id ?? `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`);
          allResultsRef.current.set(uid, p);
        });
        setResults([...allResultsRef.current.values()]);
        if (r.total) setAttomTotal(r.total);
        setHasMore(!!r.has_more);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [filters]);

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    rentcastLoadMore(filters)
      .then((r) => {
        (r.data || []).forEach((p) => {
          const uid = String(p.attom_id ?? `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`);
          allResultsRef.current.set(uid, p);
        });
        setResults([...allResultsRef.current.values()]);
        if (r.total) setAttomTotal(r.total);
        setHasMore(!!r.has_more);
        setManualSearchKey((k) => k + 1);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [filters]);

  if (!sub.loading && !sub.hasAccess) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Your trial has expired</h2>
          <p className="mt-1 text-sm text-amber-800">Subscribe to keep searching properties and using skip-trace.</p>
          <a href="/billing" className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm text-white">View plans</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Search toolbar ───────────────────────────────────── */}
      <div className="relative z-[1050] border-b border-gray-200 bg-white shadow-sm">

        {/* Main bar */}
        <div className="flex h-14 items-center gap-3 px-5">

          {/* Search input */}
          <div className="relative min-w-0 flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={inputRef}
              value={queryText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { clearTimeout(autoSearchTimerRef.current); submitSearch(); } }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search by ZIP code, city, or address…"
              autoComplete="off"
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {queryText && (
              <button
                onClick={() => { setQueryText(''); setParseError(''); setSuggestions([]); setShowSuggestions(false); setFilters({}); setSearchParams({}, { replace: true }); setResults([]); clearTimeout(autoSearchTimerRef.current); clearTimeout(suggestTimerRef.current); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-gray-400 transition-colors hover:text-gray-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl z-[2000]">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onMouseDown={() => pickSuggestion(s)}
                    className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px shrink-0 bg-gray-200" />

          {/* Property type */}
          <div className="relative shrink-0">
            <select
              value={filters.propertytype ?? ''}
              onChange={(e) => handleTypeChange(e.target.value)}
              className={`h-9 appearance-none rounded-lg border pl-3 pr-7 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                filters.propertytype
                  ? 'border-blue-400 bg-blue-50 text-blue-700 hover:border-blue-500'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:border-blue-500'
              }`}
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Lead type — quick filter in the main bar */}
          <div className="relative shrink-0">
            <select
              value={advFilters.ownerOccupied}
              onChange={e => {
                const val = e.target.value;
                const next = { ...advFiltersRef.current, ownerOccupied: val };
                setAdvFilters(next);
                advFiltersRef.current = next;
                const loc = {};
                if (filters.postalcode) loc.postalcode = filters.postalcode;
                if (filters.city)       loc.city = filters.city;
                if (filters.state)      loc.state = filters.state;
                applyFilters(loc, filters.propertytype, val);
              }}
              className={`h-9 appearance-none rounded-lg border pl-3 pr-7 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                advFilters.ownerOccupied
                  ? 'border-blue-400 bg-blue-50 text-blue-700 hover:border-blue-500'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:border-blue-500'
              }`}
            >
              <option value="">All Leads</option>
              <option value="absentee">Absentee Owner</option>
              <option value="owner">Owner Occupied</option>
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* More Filters toggle */}
          {(() => {
            const advOnlyCount = Object.entries(advFilters)
              .filter(([k, v]) => k !== 'ownerOccupied' && v !== '').length;
            return (
              <button
                onClick={() => setShowAdvFilters(o => !o)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  showAdvFilters || advOnlyCount > 0
                    ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M7 12h10M11 18h2" />
                </svg>
                More Filters
                {advOnlyCount > 0 && (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
                    {advOnlyCount}
                  </span>
                )}
              </button>
            );
          })()}

          {/* Result count */}
          <div className="shrink-0 min-w-[100px] text-right">
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Searching…
              </span>
            ) : results.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {results.length.toLocaleString()}
                <span className="text-gray-400">props</span>
              </span>
            ) : (filters.postalcode || filters.city) ? (
              <span className="text-xs text-gray-400">No results</span>
            ) : null}
          </div>
        </div>

        {/* Advanced filter panel */}
        {showAdvFilters && (
          <div className="border-t border-gray-100 bg-gray-50/80 px-5 py-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">

              {/* Bedrooms */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Bedrooms</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" max="20" step="1" placeholder="Min"
                    value={advFilters.bedroomsMin}
                    onChange={e => setAdvFilters(p => ({...p, bedroomsMin: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                  <span className="shrink-0 text-xs text-gray-300">–</span>
                  <input type="number" min="0" max="20" step="1" placeholder="Max"
                    value={advFilters.bedroomsMax}
                    onChange={e => setAdvFilters(p => ({...p, bedroomsMax: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                </div>
              </div>

              {/* Bathrooms */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Bathrooms</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" max="20" step="0.5" placeholder="Min"
                    value={advFilters.bathroomsMin}
                    onChange={e => setAdvFilters(p => ({...p, bathroomsMin: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                  <span className="shrink-0 text-xs text-gray-300">–</span>
                  <input type="number" min="0" max="20" step="0.5" placeholder="Max"
                    value={advFilters.bathroomsMax}
                    onChange={e => setAdvFilters(p => ({...p, bathroomsMax: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                </div>
              </div>

              {/* Sq Ft */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Sq Ft</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" step="100" placeholder="Min"
                    value={advFilters.sqftMin}
                    onChange={e => setAdvFilters(p => ({...p, sqftMin: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                  <span className="shrink-0 text-xs text-gray-300">–</span>
                  <input type="number" min="0" step="100" placeholder="Max"
                    value={advFilters.sqftMax}
                    onChange={e => setAdvFilters(p => ({...p, sqftMax: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                </div>
              </div>

              {/* Year Built */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Year Built</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="1800" max="2030" step="1" placeholder="From"
                    value={advFilters.yearBuiltMin}
                    onChange={e => setAdvFilters(p => ({...p, yearBuiltMin: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                  <span className="shrink-0 text-xs text-gray-300">–</span>
                  <input type="number" min="1800" max="2030" step="1" placeholder="To"
                    value={advFilters.yearBuiltMax}
                    onChange={e => setAdvFilters(p => ({...p, yearBuiltMax: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                </div>
              </div>

              {/* Lot Size */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Lot Size (sq ft)</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" step="500" placeholder="Min"
                    value={advFilters.lotSizeMin}
                    onChange={e => setAdvFilters(p => ({...p, lotSizeMin: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                  <span className="shrink-0 text-xs text-gray-300">–</span>
                  <input type="number" min="0" step="500" placeholder="Max"
                    value={advFilters.lotSizeMax}
                    onChange={e => setAdvFilters(p => ({...p, lotSizeMax: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20" />
                </div>
              </div>

            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleApplyAdv}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                Apply filters
              </button>
              {Object.entries(advFilters).some(([k, v]) => k !== 'ownerOccupied' && v !== '') && (
                <button
                  onClick={handleClearAdv}
                  className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Content area — map 70 / list 30, list toggleable */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* Map — full background */}
        <div className="absolute inset-0 isolate">
          <ResultsMap properties={results.filter((p) => p.estimated_value > 0)} onViewChange={handleViewChange} manualKey={manualSearchKey} panKey={panSearchKey} hoveredId={hoveredId} onSelect={setSelectedProperty} />
        </div>

        {/* Properties list — right 20%, slides in/out. Toggle handle is attached to its left edge. */}
        <div className={`absolute right-0 top-0 h-full w-[20%] z-[1000] transition-transform duration-300 ease-in-out ${listOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {/* Toggle handle — sits on the left edge, always visible */}
          <div className="absolute -left-7 top-1/2 -translate-y-1/2 z-10">
            <button
              onClick={() => setListOpen((o) => !o)}
              title={listOpen ? 'Collapse list' : 'Expand list'}
              className="flex h-10 w-7 items-center justify-center rounded-l-full border border-gray-200 bg-white shadow-md text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                {listOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                }
              </svg>
            </button>
          </div>
          <div className="h-full overflow-y-auto border-l border-gray-200 bg-white shadow-lg flex flex-col">
            <ResultsList properties={results.filter((p) => p.estimated_value > 0)} onHover={setHoveredId} onSelect={setSelectedProperty} />
            {hasMore && (
              <div className="shrink-0 p-3 border-t border-gray-100">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? 'Loading…' : 'Load More Data'}
                </button>
                <p className="mt-1.5 text-center text-xs text-gray-400">Each click uses +1 API request</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedProperty && (
        <PropertyDetailModal property={selectedProperty} onClose={() => setSelectedProperty(null)} />
      )}
    </div>
  );
}
