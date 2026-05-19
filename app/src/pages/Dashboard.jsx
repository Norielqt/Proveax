import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rentcastSearch, rentcastLoadMore, rentcastListings } from '../api/rentcast';
import { createLead } from '../api/leads';
import { useSubscription } from '../hooks/useSubscription';
import ResultsList, { propertyKey } from '../components/search/ResultsList';
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

// Range filter chip definitions
const fmtNum = (n) => Number(n).toLocaleString();
const RANGE_DEFS = [
  { key: 'beds',  label: 'Beds',  minKey: 'bedroomsMin',  maxKey: 'bedroomsMax',  step: 1,   min: 0,    max: 20,   fmt: (n) => n,    unit: ''           },
  { key: 'baths', label: 'Baths', minKey: 'bathroomsMin', maxKey: 'bathroomsMax', step: 0.5, min: 0,    max: 20,   fmt: (n) => n,    unit: ''           },
  { key: 'sqft',  label: 'Size',  minKey: 'sqftMin',      maxKey: 'sqftMax',      step: 100, min: 0,               fmt: fmtNum,      unit: 'sqft'       },
  { key: 'year',  label: 'Year',  minKey: 'yearBuiltMin', maxKey: 'yearBuiltMax', step: 1,   min: 1800, max: 2030, fmt: (n) => n,    unit: ''           },
  { key: 'lot',   label: 'Lot',   minKey: 'lotSizeMin',   maxKey: 'lotSizeMax',   step: 500, min: 0,               fmt: fmtNum,      unit: 'sqft'       },
];
const summarizeRange = (minVal, maxVal, fmt) => {
  const hasMin = minVal !== '' && minVal !== null && minVal !== undefined;
  const hasMax = maxVal !== '' && maxVal !== null && maxVal !== undefined;
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax)   return `${fmt(minVal)}–${fmt(maxVal)}`;
  if (hasMin)             return `${fmt(minVal)}+`;
  return `≤${fmt(maxVal)}`;
};

// Lead strategy chip options (no "All" — deselecting everything = All)
const STRATEGY_OPTS = [
  { value: 'absentee_owner',  label: 'Absentee Owner'   },
  { value: 'out_of_state_owner', label: 'Out of State'  },
  { value: 'high_equity',     label: 'High Equity'      },
  { value: 'cash_buyers',     label: 'Cash Buyers'      },
  { value: 'vacant_lots',     label: 'Vacant Lots'      },
  { value: 'mls_withdrawn',   label: 'MLS Withdrawn'    },
];

const MLS_STRATEGIES = new Set(['mls_withdrawn']);

const MLS_PARAMS = {
  mls_withdrawn:{ status: 'Inactive', listingType: 'Withdrawn' },
};

/** Translate leadStrategy in filters to actual backend params */
function buildSearchParams(f) {
  const p = { ...f };
  const strategy = p.leadStrategy;
  delete p.leadStrategy;
  if (strategy === 'absentee_owner')  p.ownerOccupied = 'absentee';
  else if (strategy === 'vacant_lots') p.propertytype = 'Land';
  else if (strategy && !MLS_STRATEGIES.has(strategy)) p.strategy = strategy;
  return p;
}

/**
 * Parse a free-text query into Rentcast search params.
 * Supports:
 *   "90210"                       → { postalcode: '90210' }
 *   "Brooklyn, NY"                → { city: 'Brooklyn', state: 'NY' }
 *   "Beverly Hills CA 90210"      → { postalcode: '90210' }
 *   "123 Main St, Miami FL 33101" → { address: '123 Main St', postalcode: '33101' }
 *   "456 Oak Ave, 90210"          → { address: '456 Oak Ave', postalcode: '90210' }
 *   "789 Elm St, Miami FL"        → { address: '789 Elm St', city: 'Miami', state: 'FL' }
 * Returns null if the query can't be resolved.
 */
function parseQuery(raw) {
  const q = raw.trim();
  if (!q) return null;

  // Detect street address: starts with a house number (digits followed by a letter)
  const isStreetAddress = /^\d+\s+[A-Za-z]/.test(q);

  // Any 5-digit ZIP found anywhere
  const zipMatch = q.match(/\b(\d{5})\b/);
  const postalcode = zipMatch ? zipMatch[1] : null;

  if (isStreetAddress) {
    // Street part = everything before the first comma
    const commaIdx = q.indexOf(',');
    let streetPart;
    if (commaIdx !== -1) {
      streetPart = q.slice(0, commaIdx).trim();
    } else if (postalcode) {
      // No comma — strip ZIP (and optional preceding state abbr) from the end
      streetPart = q.replace(/\s+(?:[A-Za-z]{2}\s+)?\d{5}.*$/, '').trim();
    } else {
      streetPart = q;
    }
    const address = streetPart || q;
    const result = { address };
    if (postalcode) {
      result.postalcode = postalcode;
    } else if (commaIdx !== -1) {
      // Try to extract city + state from after the comma
      const rest = q.slice(commaIdx + 1).trim();
      const csMatch = rest.match(/^(.+?),?\s+([A-Za-z]{2})\s*$/);
      if (csMatch) {
        result.city  = csMatch[1].trim();
        result.state = csMatch[2].toUpperCase();
      }
    }
    return result;
  }

  if (postalcode) return { postalcode };

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
      leadStrategies: Array.isArray(f.leadStrategies) ? f.leadStrategies
                     : f.leadStrategy               ? [f.leadStrategy]   // backward compat
                     : [],
    };
  });
  // Ref so callbacks always see latest advFilters without needing it in dep arrays
  const advFiltersRef = useRef(advFilters);
  useEffect(() => { advFiltersRef.current = advFilters; }, [advFilters]);

  // Popover state for filter chips
  const [openFilter, setOpenFilter] = useState(null); // 'type' | 'lead' | 'beds' | 'baths' | 'sqft' | 'year' | 'lot' | null
  const filtersHostRef = useRef(null);
  useEffect(() => {
    if (!openFilter) return;
    const onDown = (e) => {
      if (filtersHostRef.current && !filtersHostRef.current.contains(e.target)) setOpenFilter(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenFilter(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openFilter]);

  // Reconstruct query text from filters for the input
  const filtersToQuery = (f) => {
    if (f.address && f.postalcode) return `${f.address}, ${f.postalcode}`;
    if (f.address && f.city && f.state) return `${f.address}, ${f.city}, ${f.state}`;
    if (f.address) return f.address;
    if (f.postalcode) return f.postalcode;
    if (f.city && f.state) return `${f.city}, ${f.state}`;
    return '';
  };
  const [queryText, setQueryText] = useState(() => filtersToQuery(initFilters()));
  const [, setParseError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimerRef = useRef(null);
  const autoSearchTimerRef = useRef(null);
  const inputRef = useRef(null);

  const [results, setResults] = useState([]);
  const [, setAttomTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const allResultsRef = useRef(new Map());
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [mobileSheet, setMobileSheet] = useState('peek'); // 'peek' | 'expanded'
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Lock body scroll while the mobile filter sheet is open
  useEffect(() => {
    if (!mobileFilterOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileFilterOpen]);
  const viewTimerRef   = useRef(null);
  const [manualSearchKey, setManualSearchKey] = useState(0);
  const [panSearchKey, setPanSearchKey] = useState(0);
  const [mapFlyTo, setMapFlyTo] = useState(null); // { center:[lng,lat], bbox:[w,s,e,n]|undefined }
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);

  // Multi-select for "Add to CRM"
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmToast, setCrmToast] = useState(null); // { count, error }

  const applyFilters = useCallback((parsed, propertytype, leadStrategiesOverride) => {
    const current = advFiltersRef.current;
    const adv = Object.fromEntries(
      Object.entries({
        ...current,
        ...(leadStrategiesOverride !== undefined ? { leadStrategies: leadStrategiesOverride } : {}),
      }).filter(([k, v]) =>
        k === 'leadStrategies' ? (Array.isArray(v) && v.length > 0) : (v !== '' && v != null)
      )
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
            center: f.center,   // [lng, lat]
            bbox:   f.bbox,     // [west, south, east, north] — may be undefined
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
  }, [fetchSuggestions]);

  // Pick a suggestion
  const pickSuggestion = useCallback((item) => {
    setQueryText(item.text);
    setSuggestions([]);
    setShowSuggestions(false);
    clearTimeout(autoSearchTimerRef.current);
    clearTimeout(suggestTimerRef.current);
    // After results load, ResultsMap flies to the first property automatically (isManualSearch)
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
    if (loading) return;
    const locationFilters = {};
    if (filters.postalcode) locationFilters.postalcode = filters.postalcode;
    if (filters.city)       locationFilters.city = filters.city;
    if (filters.state)      locationFilters.state = filters.state;
    applyFilters(locationFilters, filters.propertytype);
  }, [loading, filters, applyFilters]);

  const handleClearAdv = useCallback(() => {
    const empty = {
      bedroomsMin: '', bedroomsMax: '',
      bathroomsMin: '', bathroomsMax: '',
      sqftMin: '', sqftMax: '',
      yearBuiltMin: '', yearBuiltMax: '',
      lotSizeMin: '', lotSizeMax: '',
      leadStrategies: [],
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
    if (filters.postalcode || filters.city || filters.address) return;
    if ((filters.leadStrategies ?? []).some(s => MLS_STRATEGIES.has(s))) return; // MLS doesn't support lat/lng pan
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
  }, [filters.postalcode, filters.city, filters.address, filters.leadStrategies]);

  useEffect(() => {
    if (!filters.postalcode && (!filters.city || !filters.state) && !filters.address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setAttomTotal(0);
      return;
    }
    setLoading(true);
    setHasMore(false);
    setManualSearchKey((k) => k + 1);
    allResultsRef.current.clear();

    const strategies = filters.leadStrategies ?? [];
    let searchPromise;

    if (strategies.length === 0) {
      // No strategy filter — plain property search
      const params = buildSearchParams({ ...filters, leadStrategy: undefined });
      searchPromise = rentcastSearch(params);
    } else if (strategies.length === 1) {
      const strategy = strategies[0];
      if (MLS_STRATEGIES.has(strategy)) {
        const mlsParams = { ...MLS_PARAMS[strategy] };
        if (filters.postalcode) mlsParams.zipCode = filters.postalcode;
        if (filters.city)  mlsParams.city  = filters.city;
        if (filters.state) mlsParams.state = filters.state;
        searchPromise = rentcastListings(mlsParams);
      } else {
        searchPromise = rentcastSearch(buildSearchParams({ ...filters, leadStrategy: strategy }));
      }
    } else {
      // Multiple strategies — fan-out one call per strategy, merge & deduplicate results
      const calls = strategies.map((strategy) => {
        if (MLS_STRATEGIES.has(strategy)) {
          const mlsParams = { ...MLS_PARAMS[strategy] };
          if (filters.postalcode) mlsParams.zipCode = filters.postalcode;
          if (filters.city)  mlsParams.city  = filters.city;
          if (filters.state) mlsParams.state = filters.state;
          return rentcastListings(mlsParams).catch(() => ({ data: [] }));
        }
        return rentcastSearch(buildSearchParams({ ...filters, leadStrategy: strategy })).catch(() => ({ data: [] }));
      });
      searchPromise = Promise.all(calls).then((responses) => {
        const merged = [];
        const seen = new Set();
        for (const r of responses) {
          for (const p of (r.data || [])) {
            const uid = String(p.attom_id ?? `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`);
            if (!seen.has(uid)) { seen.add(uid); merged.push(p); }
          }
        }
        return { data: merged, total: merged.length, has_more: false };
      });
    }

    searchPromise
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

  const handleToggle = useCallback((key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((properties) => {
    setSelectedKeys((prev) => {
      const allKeys = properties.map(propertyKey);
      const allSelected = allKeys.every((k) => prev.has(k));
      if (allSelected) {
        const next = new Set(prev);
        allKeys.forEach((k) => next.delete(k));
        return next;
      }
      return new Set([...prev, ...allKeys]);
    });
  }, []);

  const handleAddToCRM = useCallback(async () => {
    if (!selectedKeys.size || crmSaving) return;
    const toAdd = results.filter((p) => selectedKeys.has(propertyKey(p)));
    const strategies = filters.leadStrategies ?? [];
    // Use the selected strategy only when exactly one is chosen; otherwise auto-detect per property
    const filterStrategy = strategies.length === 1 ? strategies[0] : null;
    setCrmSaving(true);
    setCrmToast(null);
    let saved = 0;
    let lastError = null;
    for (const p of toAdd) {
      try {
        const addr = p.address ||
          [p.street, p.city && p.state ? `${p.city}, ${p.state}` : (p.city || p.state), p.zip]
            .filter(Boolean).join(', ');
        const priceNum = p.estimated_value != null ? Number(p.estimated_value) : NaN;
        const addrStr = addr || null;

        // Auto-detect lead type from property data when no filter is active
        let sourceType = filterStrategy;
        if (!sourceType) {
          // MLS withdrawn — detected from listing_status field
          const status      = (p.listing_status ?? '').toLowerCase();
          if (status === 'withdrawn') sourceType = 'mls_withdrawn';
          else {
            // Property-data based detection
            const ownerState   = p.detail?.owner?.mail_state?.toUpperCase() ?? null;
            const propState    = (p.state ?? '').toUpperCase();
            const isAbsentee   = p.owner_occupied === false;
            const isOutOfState = ownerState && propState && ownerState !== propState;
            const isVacantLot  = (p.property_type ?? '').toLowerCase() === 'land';

            // High equity: estimated value is ≥40% more than last recorded sale price
            const lastSale     = p.detail?.transactions?.[0]?.sale_price;
            const estVal       = p.estimated_value;
            const isHighEquity = lastSale && estVal && Number(estVal) >= Number(lastSale) * 1.4;

            if      (isVacantLot)  sourceType = 'vacant_lots';
            else if (isHighEquity) sourceType = 'high_equity';
            else if (isOutOfState) sourceType = 'out_of_state_owner';
            else if (isAbsentee)   sourceType = 'absentee_owner';
          }
        }

        await createLead({
          name:        p.owner_name || addrStr,
          address:     addrStr,
          home_price:  Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
          source_type: sourceType,
        });
        saved++;
      } catch (err) {
        lastError = err?.response?.data?.message || err?.message || 'Unknown error';
        console.error('[Add to CRM] failed for property:', p.attom_id, err?.response?.data ?? err);
      }
    }
    setCrmSaving(false);
    setSelectedKeys(new Set());
    if (saved > 0) {
      setCrmToast({ count: saved, error: null });
    } else {
      setCrmToast({ count: 0, error: lastError || 'Failed to add leads. Check console for details.' });
    }
    setTimeout(() => setCrmToast(null), 6000);
  }, [selectedKeys, results, filters.leadStrategies, crmSaving]);

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    rentcastLoadMore(buildSearchParams(filters))
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
          <a href="/subscription" className="mt-4 inline-block rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">View plans</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Search toolbar ───────────────────────────────────── */}
      <div className="relative z-[1050] border-b border-black/[0.06] bg-white">

        {/* Main bar */}
        <div className="flex items-center gap-2 px-3 py-3 md:gap-3 md:px-6 md:overflow-visible" ref={filtersHostRef}>

          {/* Search input */}
          <div className="relative flex-1 min-w-0 md:w-[480px] md:flex-none">
            <button
              type="button"
              onClick={() => { clearTimeout(autoSearchTimerRef.current); submitSearch(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[#888] transition-colors hover:text-[#111] focus:outline-none"
              aria-label="Search"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>
            <input
              ref={inputRef}
              value={queryText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { clearTimeout(autoSearchTimerRef.current); submitSearch(); } }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search by ZIP, city, or address…"
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-black/[0.08] bg-[#f8f9fc] pl-10 pr-9 text-base md:text-sm text-[#1a1a1a] placeholder-[#aaa] transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/10"
            />
            {queryText && (
              <button
                onClick={() => { setQueryText(''); setParseError(''); setSuggestions([]); setShowSuggestions(false); setFilters({}); setSearchParams({}, { replace: true }); setResults([]); clearTimeout(autoSearchTimerRef.current); clearTimeout(suggestTimerRef.current); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[#888] transition-colors hover:bg-[#f4f1eb] hover:text-[#111]"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border border-black/[0.06] bg-white py-1 shadow-xl z-[2000]">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onMouseDown={() => pickSuggestion(s)}
                    className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm text-[#444] transition-colors hover:bg-[#f4f1eb] hover:text-[#000]"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mobile-only: Filter button (opens sheet) + Search submit */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen((o) => !o)}
            className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white text-[#111] hover:bg-[#fafaf8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 relative"
            aria-label="Filters"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 019 17v-4.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {Object.entries(advFilters).some(([k, v]) => k === 'leadStrategies' ? v.length > 0 : v !== '') && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => { handleApplyAdv(); setOpenFilter(null); setMobileFilterOpen(false); }}
            disabled={loading}
            className="md:hidden flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
            aria-label="Search"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>

          {/* Divider */}
          <div className="hidden md:block h-6 w-px shrink-0 bg-black/[0.06]" />

          {/* Filter chips cluster — inline on desktop, slide-down sheet on mobile */}
          <div
            className={
              mobileFilterOpen
                ? "fixed inset-x-0 top-16 bottom-0 z-[1400] flex flex-col items-stretch gap-2 overflow-y-auto overscroll-contain bg-white p-4 md:static md:inset-auto md:z-auto md:flex md:flex-1 md:flex-row md:items-center md:gap-1.5 md:overflow-visible md:overscroll-auto md:bg-transparent md:p-0 md:min-w-0"
                : "hidden md:flex md:flex-1 md:items-center md:gap-1.5 md:min-w-0"
            }
          >
            {mobileFilterOpen && (
              <div className="md:hidden flex items-center justify-between border-b border-black/[0.06] pb-3 mb-1">
                <span className="text-base font-semibold text-[#111]">Filters</span>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#888] hover:bg-[#fafaf8]"
                  aria-label="Close filters"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Property type chip */}
            {(() => {
              const selected = TYPES.find(t => t.value === (filters.propertytype ?? '')) ?? TYPES[0];
              const active = !!filters.propertytype;
              const open = openFilter === 'type';
              return (
                <div className="relative w-full md:flex-1 md:w-auto min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpenFilter(open ? null : 'type')}
                    className={`flex w-full h-10 md:h-9 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : open
                          ? 'border-blue-600 bg-white text-blue-600'
                          : 'border-black/[0.06] bg-white text-[#444] hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <span className={`truncate ${active ? '' : 'text-[#555]'}`}>Type</span>
                      {active && <span className="truncate text-blue-700">· {selected.label}</span>}
                    </span>
                    <svg className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {open && (
                    <div className="absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-black/[0.06] bg-white py-1 shadow-xl z-[2000]">
                      {TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => { handleTypeChange(t.value); setOpenFilter(null); }}
                          className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors ${
                            (filters.propertytype ?? '') === t.value
                              ? 'bg-[#f4f1eb] text-[#000] font-medium'
                              : 'text-[#444] hover:bg-[#fafaf8]'
                          }`}
                        >
                          {t.label}
                          {(filters.propertytype ?? '') === t.value && (
                            <svg className="h-3.5 w-3.5 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Lead / Strategy chip — multi-select */}
            {(() => {
              const selectedArr = advFilters.leadStrategies ?? [];
              const active = selectedArr.length > 0;
              const open = openFilter === 'lead';
              // Chip label: "Lead · Absentee Owner" (1) or "Lead · 2" (many)
              const chipSuffix = selectedArr.length === 1
                ? STRATEGY_OPTS.find(o => o.value === selectedArr[0])?.label
                : selectedArr.length > 1 ? `${selectedArr.length} selected` : null;
              return (
                <div className="relative w-full md:flex-1 md:w-auto min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpenFilter(open ? null : 'lead')}
                    className={`flex w-full h-10 md:h-9 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : open
                          ? 'border-blue-600 bg-white text-blue-600'
                          : 'border-black/[0.06] bg-white text-[#444] hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <span className={`truncate ${active ? '' : 'text-[#555]'}`}>Lead</span>
                      {chipSuffix && <span className="truncate text-blue-700">· {chipSuffix}</span>}
                    </span>
                    <svg className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {open && (
                    <div className="absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-black/[0.06] bg-white py-1 shadow-xl z-[2000]">
                      {STRATEGY_OPTS.map((o) => {
                        const checked = selectedArr.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? selectedArr.filter(v => v !== o.value)
                                : [...selectedArr, o.value];
                              const nextFilters = { ...advFiltersRef.current, leadStrategies: next };
                              setAdvFilters(nextFilters);
                              advFiltersRef.current = nextFilters;
                              const loc = {};
                              if (filters.postalcode) loc.postalcode = filters.postalcode;
                              if (filters.city)       loc.city = filters.city;
                              if (filters.state)      loc.state = filters.state;
                              applyFilters(loc, filters.propertytype, next);
                              // keep dropdown open for multi-select
                            }}
                            className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${
                              checked ? 'bg-[#f4f1eb] text-[#000] font-medium' : 'text-[#444] hover:bg-[#fafaf8]'
                            }`}
                          >
                            {/* checkbox */}
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              checked ? 'border-blue-600 bg-blue-600' : 'border-[#C5D9F0] bg-white'
                            }`}>
                              {checked && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Range chips */}
            {RANGE_DEFS.map(({ key, label, minKey, maxKey, step, min, max, fmt, unit }) => {
              const minVal = advFilters[minKey];
              const maxVal = advFilters[maxKey];
              const summary = summarizeRange(minVal, maxVal, fmt);
              const active = summary !== null;
              const open = openFilter === key;
              return (
                <div key={key} className="relative w-full md:flex-1 md:w-auto min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpenFilter(open ? null : key)}
                    className={`flex w-full h-10 md:h-9 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : open
                          ? 'border-blue-600 bg-white text-blue-600'
                          : 'border-black/[0.06] bg-white text-[#444] hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <span className={`truncate ${active ? '' : 'text-[#555]'}`}>{label}</span>
                      {active && <span className="truncate text-blue-700">· {summary}{unit ? ` ${unit}` : ''}</span>}
                    </span>
                    <svg className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {open && (
                    <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-black/[0.06] bg-white p-3.5 shadow-xl z-[2000]">
                      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#888]">{label}{unit ? ` (${unit})` : ''}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={min} max={max} step={step} placeholder="Min" autoFocus
                          value={minVal}
                          onChange={(e) => setAdvFilters((p) => ({ ...p, [minKey]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleApplyAdv(); setOpenFilter(null); } }}
                          className="h-9 w-full rounded-lg border border-black/[0.06] bg-[#fafaf8] px-3 text-base md:text-sm text-[#111] placeholder-[#888] focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/10"
                        />
                        <span className="text-xs text-[#888]">to</span>
                        <input
                          type="number" min={min} max={max} step={step} placeholder="Max"
                          value={maxVal}
                          onChange={(e) => setAdvFilters((p) => ({ ...p, [maxKey]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleApplyAdv(); setOpenFilter(null); } }}
                          className="h-9 w-full rounded-lg border border-black/[0.06] bg-[#fafaf8] px-3 text-base md:text-sm text-[#111] placeholder-[#888] focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/10"
                        />
                      </div>
                      <div className="mt-3 flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...advFiltersRef.current, [minKey]: '', [maxKey]: '' };
                            setAdvFilters(updated);
                            advFiltersRef.current = updated;
                            const loc = {};
                            if (filters.postalcode) loc.postalcode = filters.postalcode;
                            if (filters.city)       loc.city = filters.city;
                            if (filters.state)      loc.state = filters.state;
                            applyFilters(loc, filters.propertytype);
                            setOpenFilter(null);
                          }}
                          disabled={!active}
                          className="text-xs font-medium text-[#888] transition hover:text-[#111] disabled:opacity-40 disabled:hover:text-[#888]"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Clear all */}
            {Object.entries(advFilters).some(([k, v]) => k === 'leadStrategies' ? v.length > 0 : v !== '') && (
              <button
                type="button"
                onClick={() => { handleClearAdv(); setOpenFilter(null); }}
                disabled={loading}
                className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs font-medium text-[#888] transition hover:bg-[#fafaf8] hover:text-[#111] focus:outline-none disabled:opacity-50"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}

            {/* Search button (desktop only — mobile uses the inline submit next to the input) */}
            <button
              type="button"
              onClick={() => { handleApplyAdv(); setOpenFilter(null); setMobileFilterOpen(false); }}
              disabled={loading}
              className="hidden md:flex flex-1 h-9 items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              Search
            </button>

            {/* Mobile-only: Apply button inside the sheet */}
            <button
              type="button"
              onClick={() => { handleApplyAdv(); setOpenFilter(null); setMobileFilterOpen(false); }}
              disabled={loading}
              className="md:hidden mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              Apply filters & search
            </button>

            {/* Result count — inline after Search, no dead space */}
            {loading ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 pl-2 text-xs text-[#888]">
                <svg className="h-3 w-3 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Searching…
              </span>
            ) : results.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                {results.length.toLocaleString()}
                <span className="font-normal text-blue-500">results</span>
              </span>
            ) : (filters.postalcode || filters.city) ? (
              <span className="shrink-0 text-xs text-[#888]">No results</span>
            ) : null}
          </div>
        </div>
      </div>
      {/* Content area — map 70 / list 30, list toggleable */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* Map — full background */}
        <div className="absolute inset-0 isolate">
          <ResultsMap properties={results} onViewChange={handleViewChange} manualKey={manualSearchKey} panKey={panSearchKey} hoveredId={hoveredId} onSelect={setSelectedProperty} />
        </div>

        {/* Properties list — right 20%, slides in/out. Toggle handle is attached to its left edge. */}
        {/* Hidden on mobile (<md) — mobile uses the bottom sheet below */}
        <div className={`absolute right-0 top-0 h-full w-[20%] z-[1000] hidden md:block transition-transform duration-300 ease-in-out ${listOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {/* Toggle handle — sits on the left edge, always visible */}
          <div className="absolute -left-7 top-1/2 -translate-y-1/2 z-10">
            <button
              onClick={() => setListOpen((o) => !o)}
              title={listOpen ? 'Collapse list' : 'Expand list'}
              className="flex h-10 w-7 items-center justify-center rounded-l-full border border-black/[0.08] bg-white shadow-md text-[#888] hover:bg-[#fafaf8] hover:text-[#111] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                {listOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                }
              </svg>
            </button>
          </div>
          <div className="h-full overflow-y-auto border-l border-black/[0.08] shadow-lg flex flex-col" style={{ background: 'rgb(249, 249, 249)' }}>
            {/* ── Add to CRM action bar ────────────────────────────── */}
            {selectedKeys.size > 0 && (
              <div className="shrink-0 border-b border-blue-700 bg-blue-600 px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white whitespace-nowrap">
                  {selectedKeys.size} selected
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setSelectedKeys(new Set())}
                    className="text-xs text-white/70 hover:text-white transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleAddToCRM}
                    disabled={crmSaving}
                    className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    {crmSaving ? 'Saving…' : 'Add to CRM'}
                  </button>
                </div>
              </div>
            )}

            <ResultsList
              properties={results}
              onHover={setHoveredId}
              onSelect={setSelectedProperty}
              selected={selectedKeys}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
            />
            {hasMore && (
              <div className="shrink-0 p-3 border-t border-black/[0.06]">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? 'Loading…' : 'Load More Data'}
                </button>
                <p className="mt-1.5 text-center text-xs text-[#aaa]">Each click uses +1 API request</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile bottom sheet (visible on <md only) */}
        <div
          className={`absolute inset-x-0 bottom-0 z-[1000] md:hidden flex flex-col bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.12)] transition-[height] duration-300 ease-in-out`}
          style={{ height: mobileSheet === 'expanded' ? '85%' : '160px' }}
        >
          {/* Drag handle / header */}
          <button
            type="button"
            onClick={() => setMobileSheet((s) => (s === 'expanded' ? 'peek' : 'expanded'))}
            className="flex items-center justify-between px-4 pt-2 pb-2 border-b border-black/[0.06]"
            aria-label={mobileSheet === 'expanded' ? 'Collapse results' : 'Expand results'}
          >
            <span className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-[#ddd]" />
            <span className="mt-3 text-sm font-semibold text-[#111]">
              {results.length > 0 ? `${results.length.toLocaleString()} result${results.length !== 1 ? 's' : ''}` : 'No results'}
            </span>
            <svg
              className={`mt-3 h-5 w-5 text-[#888] transition-transform ${mobileSheet === 'expanded' ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Selection bar */}
          {selectedKeys.size > 0 && (
            <div className="shrink-0 border-b border-blue-700 bg-blue-600 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-white whitespace-nowrap">
                {selectedKeys.size} selected
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSelectedKeys(new Set())}
                  className="text-xs text-white/70 hover:text-white whitespace-nowrap"
                >Clear</button>
                <button
                  onClick={handleAddToCRM}
                  disabled={crmSaving}
                  className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-blue-600 disabled:opacity-60 whitespace-nowrap"
                >
                  {crmSaving ? 'Saving…' : 'Add to CRM'}
                </button>
              </div>
            </div>
          )}

          {/* Results list (scrollable when expanded) */}
          <div className="flex-1 overflow-y-auto" style={{ background: 'rgb(249, 249, 249)' }}>
            <ResultsList
              properties={results}
              onHover={setHoveredId}
              onSelect={(p) => { setSelectedProperty(p); }}
              selected={selectedKeys}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
            />
            {hasMore && (
              <div className="shrink-0 p-3 border-t border-black/[0.06]">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load More Data'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CRM toast notification ───────────────────────────────── */}
      {crmToast && (
        <div className="pointer-events-none fixed top-6 right-6 z-[9999]">
          <div className={`pointer-events-auto flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-2xl ring-1 ${
            crmToast.error
              ? 'bg-red-600 ring-red-500/40'
              : 'bg-green-600 ring-green-500/40'
          }`}>
            {crmToast.error ? (
              <svg className="h-5 w-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-semibold text-white">
              {crmToast.error
                ? crmToast.error
                : `${crmToast.count} lead${crmToast.count !== 1 ? 's' : ''} added to CRM successfully`
              }
            </span>
            <button
              onClick={() => setCrmToast(null)}
              className="ml-2 rounded-full p-0.5 text-white/70 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {selectedProperty && (
        <PropertyDetailModal property={selectedProperty} onClose={() => setSelectedProperty(null)} />
      )}
    </div>
  );
}
