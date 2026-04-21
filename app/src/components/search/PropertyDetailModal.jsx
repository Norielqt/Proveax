import { useEffect, useState, createContext, useContext } from 'react';

const LoadingCtx = createContext(false);
import { runSkipTrace } from '../../api/properties';
import { rentcastFullDetail } from '../../api/rentcast';
import { useSubscription } from '../../hooks/useSubscription';

const isRentcastId = (id) => !!id && String(id).length > 5 && /[a-zA-Z]/.test(String(id));
const fmt$  = (v) => (v != null && v !== '') ? `$${Number(v).toLocaleString()}` : null;

export default function PropertyDetailModal({ property, onClose }) {
  const sub = useSubscription();

  const [p,        setP]        = useState(property);
  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [trace,    setTrace]    = useState(null);
  const [tracing,  setTracing]  = useState(false);
  const [traceErr, setTraceErr] = useState('');
  const [tab,      setTab]      = useState('property');

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
    const rid = property.attom_id; // attom_id holds Rentcast ID (compat alias)
    if (rid && isRentcastId(String(rid))) {
      fetchReport({ rentcastId: rid });
    } else if (property.address && property.city) {
      fetchReport({ address: property.address, zipCode: property.zip });
    }
  }, [property.attom_id]); // eslint-disable-line

  useEffect(() => {
    if (report && (!p?.address || !p?.city)) {
      const loc = report.location ?? {};
      setP((prev) => ({ ...prev, address: loc.line1 ?? loc.address_full ?? '', city: loc.city ?? '', state: loc.state ?? '', zip: loc.zip ?? '' }));
    }
  }, [report]); // eslint-disable-line

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

  const doSkipTrace = async () => {
    setTracing(true); setTraceErr('');
    try { setTrace(await runSkipTrace(p.attom_id ?? p.id)); }
    catch (e) { setTraceErr(e.response?.data?.message || 'Failed.'); }
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
      className="fixed inset-0 z-[2000] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-5xl my-8 bg-gray-50 rounded-2xl shadow-2xl overflow-hidden">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ── Hero header ─────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 pt-8 pb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap pr-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-4 w-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">Property Detail</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight">{address}</h1>
              <p className="text-blue-200 mt-0.5">{cityLine}</p>
            </div>
            {!hasReport && (
              <button
                onClick={() => {
                  const rid = p.attom_id;
                  rid && isRentcastId(String(rid))
                    ? fetchReport({ rentcastId: rid })
                    : fetchReport({ address: p.address || p.street, zipCode: p.zip });
                }}
                disabled={loading}
                className="rounded-lg bg-white/15 border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-50 shrink-0 transition-colors"
              >
                {loading ? 'Loading…' : 'Load full report'}
              </button>
            )}
            {loading && hasReport && (
              <span className="flex items-center gap-1.5 text-sm text-blue-200 animate-pulse">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Refreshing…
              </span>
            )}
          </div>


        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            {error}
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-200 bg-white">
          {[
            { id: 'property',     label: 'Property' },
            { id: 'owner',        label: 'Owner' },
            { id: 'transactions', label: 'Transaction History' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">

          <LoadingCtx.Provider value={loading && !hasReport}>

          {/* ── Tab: Property ─────────────────────────────────────────────────── */}
          {tab === 'property' && (
            <div className="space-y-4">
              <Card title="Property Characteristics" loading={loading && !hasReport}>
                <div className="grid gap-8 md:grid-cols-2">
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

              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Valuation &amp; Assessment" loading={loading && !hasReport}>
                  <div className="space-y-4">
                    <FieldGroup heading="AVM (Automated)">
                      <StatRow label="Estimate" value={fmt$(val.avm_value)} accent />
                      <StatRow label="Low"      value={fmt$(val.avm_low)} />
                      <StatRow label="High"     value={fmt$(val.avm_high)} />
                    </FieldGroup>
                    <FieldGroup heading="Assessed Value">
                      <StatRow label="Land"  value={fmt$(val.assessed_land)} />
                      <StatRow label="Total" value={fmt$(val.assessed_total)} />
                    </FieldGroup>
                    <FieldGroup heading="Taxes">
                      <StatRow label="Tax year"   value={val.tax_year} />
                      <StatRow label="Tax amount" value={fmt$(val.tax_amount)} />
                      {val.hoa_fee && <StatRow label="HOA fee" value={fmt$(val.hoa_fee)} />}
                    </FieldGroup>
                  </div>
                </Card>

                <Card title="Location" loading={loading && !hasReport}>
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

          {/* ── Tab: Owner ────────────────────────────────────────────────────── */}
          {tab === 'owner' && (
            <div className="space-y-4">
              <Card title="Owner Info" loading={loading && !hasReport}>
                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <FieldGroup heading="Ownership">
                      <StatRow label="Owner 1"         value={own.owner1_name ?? p.owner_name} />
                      <StatRow label="Owner 2"         value={own.owner2_name} />
                      <StatRow label="Ownership type"  value={own.owner_type} />
                      <StatRow label="Absentee status" value={own.absentee} />
                      <StatRow label="Mailing address" value={own.mail_addr ?? p.owner_mailing_address} />
                    </FieldGroup>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Skip Trace</p>
                    <button
                      onClick={doSkipTrace}
                      disabled={tracing}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {tracing
                        ? <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Running…</>
                        : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/></svg> Run skip trace</>
                      }
                    </button>
                    {traceErr && <p className="mt-2 text-sm text-red-600">{traceErr}</p>}
                    {trace && (
                      <div className="mt-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-4 space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">Phones</p>
                          <p className="text-sm font-medium text-gray-900">
                            {sub.isActive
                              ? (trace.phones?.join(', ') || '—')
                              : <><span className="blur-sm select-none pointer-events-none">{trace.phones?.map(() => '●●●-●●●-●●●●').join(', ') || '●●●-●●●-●●●●'}</span><span className="ml-2 text-xs text-indigo-600 font-semibold">Upgrade to reveal</span></>
                            }
                          </p>
                        </div>
                        {trace.emails?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">Emails</p>
                            <p className="text-sm font-medium text-gray-900">{trace.emails.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── Tab: Transaction History ──────────────────────────────────────── */}
          {tab === 'transactions' && (
            <div className="space-y-4">
              <Card title={`Transaction History${txns.length ? ` · ${txns.length} records` : ''}`} loading={loading && !hasReport}>
                {txns.length === 0 && hasReport ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <svg className="h-10 w-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No recorded transactions found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b-2 border-gray-100">
                          <th className="pb-3 pr-6 font-semibold">Date</th>
                          <th className="pb-3 pr-6 font-semibold">Sale Price</th>
                          <th className="pb-3 font-semibold">Event</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txns.map((t, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                            <td className="py-3 pr-6 text-gray-600 font-mono text-xs">{t.sale_date}</td>
                            <td className="py-3 pr-6 font-semibold text-gray-900">{fmt$(t.sale_price) ?? <span className="text-gray-300">—</span>}</td>
                            <td className="py-3">
                              {t.event
                                ? <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{t.event}</span>
                                : <span className="text-gray-300">—</span>
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
  );
}

// ─── UI Primitives ────────────────────────────────────────────────────────────


function Card({ title, loading, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
        <h2 className="text-sm font-semibold text-gray-800" dangerouslySetInnerHTML={{ __html: title }} />
        {loading && (
          <span className="flex items-center gap-1 text-xs text-gray-400 animate-pulse">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            Loading…
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldGroup({ heading, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2"
        dangerouslySetInnerHTML={{ __html: heading }} />
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function StatRow({ label, value, accent }) {
  const isLoading = useContext(LoadingCtx);
  const empty = value === null || value === undefined || value === '';
  if (!isLoading && empty) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-sm font-semibold text-right ${accent ? 'text-blue-600' : 'text-gray-900'}`}>
        {isLoading && empty
          ? <span className="inline-block h-3 w-24 rounded-md bg-gray-200 animate-pulse" />
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
    <p className={`text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 ${className}`}>
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
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-sm font-semibold text-right ${empty ? 'text-gray-300' : 'text-gray-900'}`}>
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

