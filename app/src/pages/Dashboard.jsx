import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { attomSearch } from '../api/attom';
import { useSubscription } from '../hooks/useSubscription';
import ResultsList from '../components/search/ResultsList';
import ResultsMap  from '../components/search/ResultsMap';
import PropertyDetailModal from '../components/search/PropertyDetailModal';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'single_family', label: 'Single Family' },
  { value: 'multi_family',  label: 'Multi Family' },
  { value: 'condo',         label: 'Condo' },
  { value: 'townhouse',     label: 'Townhouse' },
  { value: 'land',          label: 'Land' },
  { value: 'commercial',    label: 'Commercial' },
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
  const allResultsRef = useRef(new Map());
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const viewTimerRef   = useRef(null);
  const [manualSearchKey, setManualSearchKey] = useState(0);
  const [panSearchKey, setPanSearchKey] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);

  const applyFilters = useCallback((parsed, propertytype) => {
    const next = { ...parsed, ...(propertytype ? { propertytype } : {}) };
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

  // Fired by map on pan/zoom
  const handleViewChange = useCallback(({ lat, lng, radius }) => {
    if (filters.postalcode || filters.city) return;
    clearTimeout(viewTimerRef.current);
    viewTimerRef.current = setTimeout(() => {
      setLoading(true);
      attomSearch({ latitude: lat, longitude: lng, radius, pagesize: 100 })
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
    setManualSearchKey((k) => k + 1);
    allResultsRef.current.clear();
    attomSearch(filters)
      .then((r) => {
        const fresh = r.data || [];
        fresh.forEach((p) => {
          const uid = String(p.attom_id ?? `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`);
          allResultsRef.current.set(uid, p);
        });
        setResults([...allResultsRef.current.values()]);
        if (r.total) setAttomTotal(r.total);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
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

      {/* Search bar */}
      <div className="relative z-[1050] border-b bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Unified search input */}
          <div className="relative flex-1">
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
              placeholder="Search ZIP, city, or address…"
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 py-1.5 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none"
            />
            {queryText && (
              <button
                onClick={() => { setQueryText(''); setParseError(''); setSuggestions([]); setShowSuggestions(false); setFilters({}); setSearchParams({}, { replace: true }); setResults([]); clearTimeout(autoSearchTimerRef.current); clearTimeout(suggestTimerRef.current); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 rounded-md border border-gray-200 bg-white shadow-lg z-[2000] overflow-hidden">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onMouseDown={() => pickSuggestion(s)}
                    className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Property type */}
          <select
            value={filters.propertytype ?? ''}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Result count */}
          <span className="shrink-0 text-xs text-gray-400 min-w-[90px] text-right">
            {loading
              ? 'Searching…'
              : results.length > 0
                ? `${results.length.toLocaleString()} properties`
                : (filters.postalcode || filters.city ? 'No results' : '')}
          </span>
        </div>
      </div>

      {/* Content area — map 70 / list 30, list toggleable */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* Map — full background */}
        <div className="absolute inset-0 isolate">
          <ResultsMap properties={results.filter((p) => p.estimated_value > 0)} onViewChange={handleViewChange} manualKey={manualSearchKey} panKey={panSearchKey} hoveredId={hoveredId} onSelect={setSelectedProperty} />
        </div>

        {/* Toggle handle at 80% mark */}
        <div
          className="absolute z-[1100] top-1/2 -translate-y-1/2 transition-all duration-200"
          style={{ right: listOpen ? 'calc(20% - 14px)' : 0 }}
        >
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

        {/* Properties list — right 20% */}
        {listOpen && (
          <div className="absolute right-0 top-0 h-full w-[20%] overflow-y-auto border-l border-gray-200 bg-white shadow-lg z-[1000]">
            <ResultsList properties={results.filter((p) => p.estimated_value > 0)} onHover={setHoveredId} onSelect={setSelectedProperty} />
          </div>
        )}
      </div>

      {selectedProperty && (
        <PropertyDetailModal property={selectedProperty} onClose={() => setSelectedProperty(null)} />
      )}
    </div>
  );
}
