import { useEffect, useState, createContext, useContext } from 'react';

const LoadingCtx = createContext(false);
import { runSkipTrace, getSkipTrace } from '../../api/properties';
import { rentcastFullDetail, rentcastAvm } from '../../api/rentcast';
import { createLead, SOURCE_TYPES, SOURCE_TYPE_LABELS } from '../../api/leads';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../context/AuthContext';

const SKIP_TRACE_COST = 0.20;

const isRentcastId = (id) => !!id && String(id).length > 5 && /[a-zA-Z]/.test(String(id));
const fmt$  = (v) => (v != null && v !== '') ? `$${Number(v).toLocaleString()}` : null;

export default function PropertyDetailModal({ property, onClose }) {
  const sub = useSubscription();
  const { user, refresh: refreshAuth } = useAuth();
  const balance     = Number(user?.balance ?? 0);
  const hasCredits  = balance >= SKIP_TRACE_COST;

  const [p,        setP]        = useState(property);
  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [trace,    setTrace]    = useState(null);
  const [tracing,  setTracing]  = useState(false);
  const [traceErr, setTraceErr] = useState('');

  const [crmSaving,    setCrmSaving]    = useState(false);
  const [crmToast,     setCrmToast]     = useState(null);  // 'saved' | 'error'
  const [crmPanel,     setCrmPanel]     = useState(false); // show confirmation panel
  const [crmSourceType,setCrmSourceType] = useState('');
  const [tab,      setTab]      = useState('property');

  // -- On-demand AVM (one billable /avm/value call per property) --
  const [avm,      setAvm]      = useState(null);
  const [avmLoading, setAvmLoading] = useState(false);
  const [avmErr,   setAvmErr]   = useState('');
  const loadAvm = async () => {
    setAvmLoading(true); setAvmErr('');
    try {
      const addr = p.address || p.street || (report?.location?.line1);
      const zip  = p.zip || report?.location?.zip;
      if (!addr || !zip) throw new Error('Missing address or zip');
      const r = await rentcastAvm(addr, zip);
      if (r.error || !r.data) throw new Error(r.error ?? 'No AVM returned');
      setAvm(r.data);
    } catch (e) {
      setAvmErr(e.message || 'Failed to load AVM.');
    } finally {
      setAvmLoading(false);
    }
  };

  const fetchReport = async ({ rentcastId, address, zipCode }) => {
    setLoading(true); setError('');
    try {
      const r = await rentcastFullDetail({ rentcastId, address, zipCode });
      if (r.error || !r.data) throw new Error(r.error ?? 'No data returned');
      setReport(r.data);
    } catch (e) {
      setError(e.message || 'Failed to load full report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If the search result already contains pre-computed detail, use it directly —
    // no follow-up API call needed (saves a billable Rentcast request).
    if (property.detail) {
      setReport(property.detail);
      return;
    }
    const rid = property.attom_id; // attom_id holds Rentcast ID (compat alias)
    if (rid && isRentcastId(String(rid))) {
      fetchReport({ rentcastId: rid });
    } else if (property.address && property.city) {
      fetchReport({ address: property.address, zipCode: property.zip });
    }
  }, [property.attom_id]); // eslint-disable-line

  // Auto-load AVM on modal open (cached in DB after first fetch — zero-cost on revisit)
  useEffect(() => {
    const addr = property.address || property.street;
    const zip  = property.zip;
    if (addr && zip) loadAvm();
    // eslint-disable-next-line
  }, [property.attom_id]);

  useEffect(() => {
    if (report && (!p?.address || !p?.city)) {
      const loc = report.location ?? {};
      setP((prev) => ({ ...prev, address: loc.line1 ?? loc.address_full ?? '', city: loc.city ?? '', state: loc.state ?? '', zip: loc.zip ?? '' }));
    }
  }, [report]); // eslint-disable-line

  // Pre-load any previously-run skip trace for this property (no charge).
  // Uses the Rentcast slug (attom_id) when coming from map search, or numeric
  // CRM id when coming from the properties list page.
  useEffect(() => {
    const propId = property.attom_id ?? property.id;
    if (!propId) return;
    getSkipTrace(propId)
      .then((data) => { if (data?.hit) setTrace(data); })
      .catch(() => {}); // silently ignore — trace just won't pre-fill
  }, []); // eslint-disable-line

  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // -- Source-type auto-detection ----------------------------------------
  const detectSourceType = () => {
    const status = (p.listing_status ?? '').toLowerCase();
    if (status === 'active')    return 'mls_active';
    if (status === 'pending')   return 'mls_pending';
    if (status === 'sold')      return 'mls_sold';
    if (status === 'withdrawn') return 'mls_withdrawn';

    const ownerState   = report?.owner?.mail_state?.toUpperCase() ?? null;
    const propState    = (p.state ?? '').toUpperCase();
    const isAbsentee   = p.owner_occupied === false;
    const isOutOfState = ownerState && propState && ownerState !== propState;
    const isVacantLot  = (p.property_type ?? '').toLowerCase() === 'land';

    const lastSale     = report?.transactions?.[0]?.sale_price;
    const estVal       = p.estimated_value;
    const isHighEquity = lastSale && estVal && Number(estVal) >= Number(lastSale) * 1.4;

    if (isVacantLot)  return 'vacant_lots';
    if (isHighEquity) return 'high_equity';
    if (isOutOfState) return 'out_of_state_owner';
    if (isAbsentee)   return 'absentee_owner';
    return '';
  };

  const openCrmPanel = () => {
    setCrmSourceType(detectSourceType());
    setCrmPanel(true);
    setCrmToast(null);
  };

  // All phones/emails extracted from skip-trace result (used in panel + save)
  const allPhonesMeta = trace?.phones_meta?.length
    ? trace.phones_meta
    : (trace?.phones?.length ? trace.phones.map((n) => ({ number: n })) : []);
  const allEmails = trace?.emails ?? [];

  const doAddToCrm = async () => {
    setCrmSaving(true); setCrmToast(null);
    try {
      const addr     = [p.address || p.street, p.city, p.state, p.zip].filter(Boolean).join(', ');
      // Use the actual Proveax AVM value; only fall back to estimated_value if AVM hasn't loaded
      const priceNum = avm?.avm_value != null
        ? Number(avm.avm_value)
        : (p.estimated_value != null ? Number(p.estimated_value) : null);

      const primaryPhone = allPhonesMeta[0]?.number ?? p.phone ?? null;
      const primaryEmail = allEmails[0] ?? p.email ?? null;

      await createLead({
        name:        p.owner_name || addr,
        address:     addr,
        phone:       primaryPhone,
        phones:      allPhonesMeta.length ? allPhonesMeta : undefined,
        email:       primaryEmail,
        home_price:  priceNum,
        source_type: crmSourceType || undefined,
      });
      setCrmPanel(false);
      setCrmToast('saved');
    } catch {
      setCrmToast('error');
    } finally {
      setCrmSaving(false);
      setTimeout(() => setCrmToast(null), 3500);
    }
  };

  const doSkipTrace = async () => {
    if (!hasCredits) {
      setTraceErr(`Not enough credits. Skip trace costs $${SKIP_TRACE_COST.toFixed(2)} — top up your wallet to continue.`);
      return;
    }
    setTracing(true); setTraceErr('');
    try {
      const res = await runSkipTrace(p.attom_id ?? p.id);
      setTrace(res);
      // Refresh user balance so the header pill / wallet reflect the charge or refund.
      refreshAuth?.();
    }
    catch (e) {
      const status = e.response?.status;
      if (status === 402) {
        setTraceErr(e.response?.data?.message || `Not enough credits. Skip trace costs $${SKIP_TRACE_COST.toFixed(2)} — top up your wallet to continue.`);
      } else {
        setTraceErr(e.response?.data?.message || 'Skip trace failed. Please try again.');
      }
      // Balance may have been refunded by the backend on provider failure — re-sync.
      refreshAuth?.();
    }
    finally { setTracing(false); }
  };

  const loc     = report?.location        ?? {};
  const char    = report?.characteristics ?? {};
  const own     = report?.owner           ?? {};
  const val     = report?.valuation       ?? {};
  const txns    = report?.transactions    ?? [];

  const address  = p.address || p.street || loc.line1 || loc.address_full || '';
  const cityLine = [p.city || loc.city, p.state || loc.state, p.zip || loc.zip].filter(Boolean).join(', ');
  const hasReport = !!report;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[2000] flex items-stretch md:items-start justify-center bg-black/60 backdrop-blur-sm md:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-4xl md:my-6 bg-white md:rounded-xl shadow-2xl overflow-hidden min-h-screen md:min-h-0">

        {/* Top-right actions */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          <button
            onClick={openCrmPanel}
            disabled={crmSaving}
            className="flex items-center gap-1.5 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors"
            title="Add this property to CRM"
          >
            {crmSaving ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            )}
            Add to CRM
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* CRM confirmation panel */}
        {crmPanel && (
          <div className="absolute right-3 top-[3.25rem] z-30 w-72 rounded-xl border border-black/[0.08] bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-2.5">
              <span className="text-sm font-semibold text-[#111]">Add to CRM</span>
              <button onClick={() => setCrmPanel(false)} className="text-[#aaa] hover:text-[#5a5a55] transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Contact preview */}
            <div className="px-4 py-3 space-y-2">
              {p.owner_name && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Owner</p>
                  <p className="text-xs font-medium text-[#5a5a55]">{p.owner_name}</p>
                </div>
              )}
              {allPhonesMeta.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Phones</p>
                  {allPhonesMeta.map((ph, i) => (
                    <p key={i} className="text-xs text-[#5a5a55]">
                      {ph.number}
                      {ph.type && <span className="ml-1.5 text-[#aaa]">({ph.type})</span>}
                      {ph.dnc && <span className="ml-1.5 rounded bg-red-100 px-1 text-[9px] font-semibold text-red-600">DNC</span>}
                    </p>
                  ))}
                </div>
              )}
              {allEmails.length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Emails</p>
                  {allEmails.map((em, i) => (
                    <p key={i} className="truncate text-xs text-[#5a5a55]">{em}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#aaa] italic">No email found</p>
              )}
              {allPhonesMeta.length === 0 && allEmails.length === 0 && (
                <p className="text-xs text-[#aaa] italic">No contacts — run skip trace first for best results</p>
              )}
            </div>

            {/* Lead type (source) */}
            <div className="border-t border-black/[0.06] px-4 py-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#aaa] mb-1">Lead Type</label>
                <select
                  value={crmSourceType}
                  onChange={(e) => setCrmSourceType(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs text-[#5a5a55] focus:border-blue-600 focus:outline-none"
                >
                  <option value="">— Not set —</option>
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{SOURCE_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-black/[0.06] px-4 py-3 flex gap-2">
              <button
                onClick={doAddToCrm}
                disabled={crmSaving}
                className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                {crmSaving ? 'Saving…' : 'Save to CRM'}
              </button>
              <button
                onClick={() => setCrmPanel(false)}
                className="rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-medium text-[#5a5a55] hover:bg-[#f9f9f9] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* CRM toast */}
        {crmToast && (
          <div className={`absolute right-3 top-14 z-20 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold shadow-lg ${
            crmToast === 'saved' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {crmToast === 'saved' && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            {crmToast === 'saved' ? 'Added to CRM' : 'Failed to add — try again'}
          </div>
        )}

        {/* -- Hero -- */}
        <div className="relative bg-blue-600 px-6 py-5">
          <div className="flex items-center justify-between gap-4 pr-10">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-white/70 uppercase tracking-[0.18em] mb-1">Property</p>
              <h1 className="text-xl font-bold text-white leading-tight truncate">{address}</h1>
              <p className="text-white/80 mt-0.5 text-xs">{cityLine}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!hasReport && (
                <button
                  onClick={() => {
                    const rid = p.attom_id;
                    rid && isRentcastId(String(rid))
                      ? fetchReport({ rentcastId: rid })
                      : fetchReport({ address: p.address || p.street, zipCode: p.zip });
                  }}
                  disabled={loading}
                  className="rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Loading…' : 'Load report'}
                </button>
              )}
              {loading && hasReport && (
                <span className="flex items-center gap-1 text-xs text-white/80">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Refreshing
                </span>
              )}
            </div>
          </div>

          {/* Inline stats */}
          {(() => {
            // Pick the best price source and label it accurately
            let priceLabel = 'Last Sale Price';
            let price = p.last_sale_price;
            if (price == null && p.list_price != null) {
              price = p.list_price;
              priceLabel = 'List Price';
            }
            if (price == null) {
              price = val.avm_value;
              if (price != null) priceLabel = 'Est. Market Value';
            }
            const beds  = char.beds ?? p.bedrooms;
            const baths = char.baths_total ?? p.bathrooms;
            const sqft  = char.sqft ?? p.square_feet;
            const year  = char.year_built ?? p.year_built;
            const type  = char.property_type ?? p.property_type;
            const stats = [
              price && { label: priceLabel, value: fmt$(price) },
              type  && { label: 'Type',  value: type },
              beds  && { label: 'Bed',   value: beds },
              baths && { label: 'Bath',  value: baths },
              sqft  && { label: 'SqFt',  value: Number(sqft).toLocaleString() },
              year  && { label: 'Year',  value: year },
            ].filter(Boolean);
            if (!stats.length) return null;
            return (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-3">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{s.label}</span>
                    <span className="text-sm font-semibold text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            {error}
          </div>
        )}

        {/* -- Tabs -- */}
        <div className="flex gap-1 px-4 border-b border-black/[0.08] bg-white">
          {[
            { id: 'property',     label: 'Property' },
            { id: 'owner',        label: 'Owner' },
            { id: 'transactions', label: 'Transactions' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors focus:outline-none ${
                tab === id
                  ? 'border-blue-600 text-[#111]'
                  : 'border-transparent text-[#888] hover:text-[#5a5a55]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-[#f9f9f9]">
        <div className="p-4 space-y-3">

          <LoadingCtx.Provider value={loading && !hasReport}>

          {/* -- Tab: Property --------------------------------------------------- */}
          {tab === 'property' && (
            <div className="space-y-4">
              <AvmCard
                avm={avm}
                loading={avmLoading}
                error={avmErr}
                onLoad={loadAvm}
                lastSalePrice={p.last_sale_price}
              />

              <Card title="Property Characteristics" loading={loading && !hasReport} icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6">
                <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  <div className="space-y-4">
                    <FieldGroup heading="Size &amp; Rooms">
                      <StatRow label="Type"         value={char.property_type ?? p.property_type} />
                      <StatRow label="Bedrooms"     value={char.beds ?? p.bedrooms} />
                      <StatRow label="Bathrooms"    value={char.baths_total ?? p.bathrooms} />
                      <StatRow label="Sq Ft"        value={char.sqft?.toLocaleString() ?? p.square_feet?.toLocaleString()} />
                      <StatRow label="Lot (sqft)"   value={char.lot_sqft?.toLocaleString()} />
                      <StatRow label="Stories"      value={char.stories} />
                      <StatRow label="Units"        value={char.unit_count} />
                    </FieldGroup>
                    <FieldGroup heading="Structure">
                      <StatRow label="Year built"      value={char.year_built ?? p.year_built} />
                      <StatRow label="Arch style"      value={char.arch_style} />
                      <StatRow label="Exterior type"   value={char.exterior_type} />
                      <StatRow label="Foundation"      value={char.foundation_type} />
                      <StatRow label="Roof type"       value={char.roof_type} />
                      <StatRow label="View type"       value={char.view_type} />
                    </FieldGroup>
                  </div>
                  <div className="space-y-4">
                    <FieldGroup heading="Interior &amp; Amenities">
                      <StatRow label="Garage type"    value={char.garage_type} />
                      <StatRow label="Garage spaces"  value={char.garage_spaces} />
                      <StatRow label="Pool type"      value={char.pool_type} />
                      <StatRow label="Fireplace type" value={char.fireplace_type} />
                      <StatRow label="Heating type"   value={char.heating_type} />
                      <StatRow label="Cooling type"   value={char.cooling_type} />
                    </FieldGroup>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3 md:grid-cols-2">
                <Card title="Valuation &amp; Assessment" loading={loading && !hasReport} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
                  <div className="space-y-4">
                    <FieldGroup heading="AVM (Automated)">
                      <StatRow label="Estimate" value={fmt$(val.avm_value)} accent />
                      <StatRow label="Low"      value={fmt$(val.avm_low)} />
                      <StatRow label="High"     value={fmt$(val.avm_high)} />
                    </FieldGroup>
                    <FieldGroup heading="Assessed Value">
                      <StatRow label="Land"         value={fmt$(val.assessed_land)} />
                      <StatRow label="Improvements" value={fmt$(val.assessed_impr)} />
                      <StatRow label="Total"        value={fmt$(val.assessed_total)} />
                    </FieldGroup>
                    <FieldGroup heading="Taxes">
                      <StatRow label="Tax year"   value={val.tax_year} />
                      <StatRow label="Tax amount" value={fmt$(val.tax_amount)} />
                      {val.hoa_fee && <StatRow label="HOA fee" value={fmt$(val.hoa_fee)} />}
                    </FieldGroup>
                  </div>
                </Card>

                <Card title="Location" loading={loading && !hasReport} icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z">
                  <div className="space-y-4">
                    <FieldGroup heading="Address">
                      <StatRow label="Full address" value={loc.address_full} />
                      <StatRow label="City"         value={loc.city ?? p.city} />
                      <StatRow label="State"        value={loc.state ?? p.state} />
                      <StatRow label="ZIP"          value={loc.zip ?? p.zip} />
                      <StatRow label="Coordinates"  value={loc.lat && loc.lng ? `${(+loc.lat).toFixed(5)}, ${(+loc.lng).toFixed(5)}` : null} />
                    </FieldGroup>
                    <FieldGroup heading="Legal">
                      <StatRow label="APN"         value={loc.apn} />
                      <StatRow label="County"      value={loc.county} />
                      <StatRow label="Subdivision" value={loc.subdivision} />
                      <StatRow label="Zoning"      value={loc.zoning} />
                      <StatRow label="Legal desc." value={loc.legal_description} />
                    </FieldGroup>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* -- Tab: Owner ------------------------------------------------------ */}
          {tab === 'owner' && (
            <div className="space-y-4">
              <Card title="Owner Info" loading={loading && !hasReport} icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                  <div>
                    <FieldGroup heading="Ownership">
                      <StatRow label="Owner 1"         value={own.owner1_name ?? p.owner_name} />
                      <StatRow label="Owner 2"         value={own.owner2_name} />
                      <StatRow label="Ownership type"  value={own.owner_type} />
                      <StatRow label="Status" value={own.absentee} />
                      <StatRow label="Mailing address" value={own.mail_addr ?? p.owner_mailing_address} />
                    </FieldGroup>
                  </div>
                  <div>
                    {trace ? (
                      /* -- Results: same FieldGroup/StatRow style as Ownership -- */
                      <FieldGroup heading="Skip Trace">
                        {trace.owner_name && <StatRow label="Owner" value={trace.owner_name} />}
                        {(trace.phones?.length > 0) && (
                          trace.phones.map((ph, i) => (
                            <StatRow
                              key={i}
                              label={i === 0 ? 'Phone' : `Phone ${i + 1}`}
                              value={
                                sub.isActive
                                  ? ph
                                  : <span className="blur-sm select-none pointer-events-none text-[#aaa]">???-???-????</span>
                              }
                            />
                          ))
                        )}
                        {(trace.emails?.length > 0) ? (
                          trace.emails.map((em, i) => (
                            <StatRow
                              key={i}
                              label={i === 0 ? 'Email' : `Email ${i + 1}`}
                              value={
                                sub.isActive
                                  ? em
                                  : <span className="blur-sm select-none pointer-events-none text-[#aaa]">?????@???.com</span>
                              }
                            />
                          ))
                        ) : (
                          <StatRow label="Email" value="No data found" />
                        )}
                        {!trace.hit && (
                          <p className="text-xs text-[#aaa] mt-1">No contact info found for this address.</p>
                        )}
                      </FieldGroup>
                    ) : (
                      /* -- Pre-trace: button + warnings -- */
                      <FieldGroup heading="Skip Trace">
                        {!hasCredits && !tracing && (
                          <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                            <p className="text-xs text-amber-700">Balance {`$${balance.toFixed(2)}`} — need {`$${SKIP_TRACE_COST.toFixed(2)}`}. Top up your wallet.</p>
                          </div>
                        )}
                        {traceErr && (
                          <p className="mb-2 text-xs text-red-500">{traceErr}</p>
                        )}
                        <button
                          onClick={doSkipTrace}
                          disabled={tracing || !hasCredits}
                          title={!hasCredits ? `Not enough credits — $${SKIP_TRACE_COST.toFixed(2)} required` : undefined}
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-[#eee] disabled:text-[#aaa] transition-colors"
                        >
                          {tracing ? (
                            <><svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Running…</>
                          ) : (
                            <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/></svg> Run skip trace · {`$${SKIP_TRACE_COST.toFixed(2)}`}</>
                          )}
                        </button>
                      </FieldGroup>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* -- Tab: Transaction History ---------------------------------------- */}
          {tab === 'transactions' && (
            <div className="space-y-4">
              <Card title={`Transaction History${txns.length ? ` · ${txns.length} records` : ''}`} loading={loading && !hasReport} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-6 4h4">
                {txns.length === 0 && hasReport ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#aaa]">
                    <svg className="h-10 w-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No recorded transactions found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-[#aaa] border-b-2 border-black/[0.06]">
                          <th className="pb-3 pr-6 font-semibold">Date</th>
                          <th className="pb-3 pr-6 font-semibold">Sale Price</th>
                          <th className="pb-3 font-semibold">Event</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txns.map((t, i) => (
                          <tr key={i} className="border-b border-black/[0.04] hover:bg-[#f5f5f5]/40 transition-colors">
                            <td className="py-3 pr-6 text-[#5a5a55] text-xs">
                              {t.sale_date
                                ? new Date(t.sale_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                : <span className="text-[#ddd]">—</span>}
                            </td>
                            <td className="py-3 pr-6 font-semibold text-[#111]">{fmt$(t.sale_price) ?? <span className="text-[#ddd]">—</span>}</td>
                            <td className="py-3">
                              {t.event
                                ? <span className="inline-flex items-center rounded-full bg-[#f5f5f5] border border-black/[0.06] px-2.5 py-0.5 text-xs font-medium text-[#111]">{t.event}</span>
                                : <span className="text-[#ddd]">—</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          </LoadingCtx.Provider>

        </div>
        </div>
      </div>
    </div>
  );
}

// --- UI Primitives ------------------------------------------------------------


function Card({ title, loading, children, icon }) {
  return (
    <div className="rounded-lg border border-black/[0.08] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06]">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon ?? 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
          </svg>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5a5a55]" dangerouslySetInnerHTML={{ __html: title }} />
        </div>
        {loading && (
          <span className="flex items-center gap-1 text-[10px] text-[#aaa] animate-pulse">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            Loading
          </span>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function FieldGroup({ heading, children }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] mb-1 pb-1 border-b border-black/[0.06]"
        dangerouslySetInnerHTML={{ __html: heading }} />
      <dl>{children}</dl>
    </div>
  );
}

function StatRow({ label, value, accent }) {
  const isLoading = useContext(LoadingCtx);
  const empty = value === null || value === undefined || value === '';
  if (!isLoading && empty) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <dt className="text-xs text-[#888] shrink-0">{label}</dt>
      <dd className={`text-xs font-semibold text-right truncate ${accent ? 'text-[#111]' : 'text-[#111]'}`}>
        {isLoading && empty
          ? <span className="inline-block h-3 w-20 rounded bg-[#eee] animate-pulse" />
          : value
        }
      </dd>
    </div>
  );
}

// Legacy aliases kept for compatibility
function Section({ title, loading, children }) {
  return <Card title={title} loading={loading}>{children}</Card>;
}
function SubHead({ children, className = '' }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wider text-[#aaa] mb-2 ${className}`}>
      {children}
    </p>
  );
}
function Row({ label, value }) {
  return <StatRow label={label} value={value} />;
}
function RowFixed({ label, value }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <dt className="text-sm text-[#888] shrink-0">{label}</dt>
      <dd className={`text-sm font-semibold text-right ${empty ? 'text-[#ddd]' : 'text-[#111]'}`}>
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

// --- AVM Card ----------------------------------------------------------------
function AvmCard({ avm, loading, error, onLoad, lastSalePrice }) {
  // Empty state — show a load button (1 billable Rentcast call)
  if (!avm && !loading && !error) {
    return (
      <div className="rounded-lg border border-black/[0.08] bg-[#f5f5f5] p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#111]">Estimated Market Value</p>
          <p className="text-xs text-[#5a5a55] mt-0.5">Run Proveax AVM to fetch market estimate, confidence range &amp; comparable sales.</p>
        </div>
        <button
          onClick={onLoad}
          className="shrink-0 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition-colors"
        >
          Load AVM
        </button>
      </div>
    );
  }

  if (loading && !avm) {
    return (
      <div className="rounded-lg border border-black/[0.08] bg-[#f5f5f5] p-4 flex items-center gap-2 text-xs text-[#111]">
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          Fetching AVM &amp; comparables…
      </div>
    );
  }

  if (error && !avm) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
        <p className="text-xs text-red-700">{error}</p>
        <button onClick={onLoad} className="shrink-0 rounded-md bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white">Retry</button>
      </div>
    );
  }

  const value = avm.avm_value;
  const low   = avm.avm_low;
  const high  = avm.avm_high;
  const lsp   = lastSalePrice ?? avm.last_sale_price;
  const delta = (value != null && lsp != null) ? value - lsp : null;
  const pct   = (delta != null && lsp > 0) ? (delta / lsp) * 100 : null;

  // Range bar: position the marker between low and high
  let markerPct = 50;
  if (value != null && low != null && high != null && high > low) {
    markerPct = Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
  }

  const comps = (avm.comparables || []).slice(0, 3);

  return (
    <div className="rounded-lg border border-black/[0.08] bg-white shadow-sm overflow-hidden">
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Proveax AVM</p>
          <p className="text-2xl font-bold text-white leading-tight">{value != null ? `$${Number(value).toLocaleString()}` : '—'}</p>
        </div>
        {delta != null && (
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">vs Last Sale</p>
            <p className={`text-sm font-bold ${delta >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {delta >= 0 ? '+' : ''}${Math.abs(delta).toLocaleString()}
              {pct != null && <span className="ml-1 text-xs opacity-90">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>}
            </p>
            <p className="text-[10px] text-white/70 mt-0.5">Sold ${Number(lsp).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Confidence range bar */}
      {low != null && high != null && (
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#aaa] mb-1">
            <span>Low ${Number(low).toLocaleString()}</span>
            <span className="text-[#888]">85% confidence range</span>
            <span>High ${Number(high).toLocaleString()}</span>
          </div>
          <div className="relative h-2 rounded-full bg-gradient-to-r from-amber-200 via-[#ddd] to-emerald-200">
            <div
              className="absolute -top-1 h-4 w-1 bg-blue-600 rounded-sm shadow-md"
              style={{ left: `calc(${markerPct}% - 2px)` }}
              title={`Estimate: $${Number(value).toLocaleString()}`}
            />
          </div>
        </div>
      )}

      {/* Comparable sales */}
      {comps.length > 0 && (
        <div className="px-4 pt-3 pb-4 border-t border-black/[0.06] mt-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] mb-2">Comparable Sales · {comps.length}</p>
          <div className="space-y-1.5">
            {comps.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md bg-[#f9f9f9] hover:bg-[#f5f5f5]/40 px-3 py-2 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#111] truncate">{c.address}</p>
                  <p className="text-[10px] text-[#888] mt-0.5">
                    {[c.bedrooms && `${c.bedrooms}bd`, c.bathrooms && `${c.bathrooms}ba`, c.square_feet && `${Number(c.square_feet).toLocaleString()} sqft`, c.distance != null && `${c.distance.toFixed(2)} mi`].filter(Boolean).join(' \u00b7 ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[#111]">{c.price != null ? `$${Number(c.price).toLocaleString()}` : '—'}</p>
                  {c.correlation != null && (
                    <p className="text-[10px] text-[#aaa]">{Math.round(c.correlation * 100)}% match</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

