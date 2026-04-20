import { useEffect, useState } from 'react';
import { runSkipTrace } from '../../api/properties';
import { attomFullDetail } from '../../api/attom';
import { useSubscription } from '../../hooks/useSubscription';

const isAttomId = (id) => /^\d{5,}$/.test(String(id));
const fmt$  = (v) => (v != null && v !== '') ? `$${Number(v).toLocaleString()}` : null;
const fmtPct= (v) => (v != null && v !== '') ? `${v}%` : null;

export default function PropertyDetailModal({ property, onClose }) {
  const sub = useSubscription();

  const [p,        setP]        = useState(property);
  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [trace,    setTrace]    = useState(null);
  const [tracing,  setTracing]  = useState(false);
  const [traceErr, setTraceErr] = useState('');

  const fetchReport = async ({ attomId, address1, address2 }) => {
    setLoading(true); setError('');
    try {
      const r = await attomFullDetail({ attomId, address1, address2 });
      if (r.error || !r.data) throw new Error(r.error ?? 'No data returned');
      setReport(r.data);
    } catch (e) {
      setError(e.message || 'Failed to load full report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const aid = property.attom_id;
    if (aid && isAttomId(String(aid))) {
      fetchReport({ attomId: aid });
    } else if (property.address && property.city) {
      fetchReport({ address1: property.address, address2: `${property.city} ${property.state} ${property.zip}` });
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
  const mortg   = report?.mortgage        ?? {};
  const permits = report?.permits         ?? [];

  const address  = p.address || p.street || loc.line1 || loc.address_full || '';
  const cityLine = [p.city || loc.city, p.state || loc.state, p.zip || loc.zip].filter(Boolean).join(', ');
  const hasReport = !!report;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-5xl my-8 bg-white rounded-xl shadow-2xl">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap pr-10">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{address}</h1>
              <div className="text-gray-500">{cityLine}</div>
              {loc.attom_id && <div className="mt-1 text-xs text-gray-400">ATTOM ID: {loc.attom_id}</div>}
            </div>
            {!hasReport && (
              <button
                onClick={() => {
                  const aid = p.attom_id;
                  aid && isAttomId(String(aid))
                    ? fetchReport({ attomId: aid })
                    : fetchReport({ address1: p.address || p.street, address2: `${p.city} ${p.state} ${p.zip}` });
                }}
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
              >
                {loading ? 'Loading report…' : 'Load full report'}
              </button>
            )}
            {loading && hasReport && <span className="text-sm text-gray-400 animate-pulse">Refreshing…</span>}
          </div>

          {error && <p className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">{error}</p>}

          {/* ── Row 1: Characteristics + Owner/Mortgage ─────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2">

            {/* Property characteristics */}
            <Section title="Property characteristics" loading={loading && !hasReport}>
              <SubHead>Size &amp; rooms</SubHead>
              <dl className="space-y-1 text-sm">
                <Row label="Type"          value={char.property_type ?? p.property_type} />
                <Row label="Sub-type"      value={char.prop_subtype} />
                <Row label="Bedrooms"      value={char.beds ?? p.bedrooms} />
                <Row label="Baths (full)"  value={char.baths_full} />
                <Row label="Baths (half)"  value={char.baths_half} />
                <Row label="Baths (total)" value={char.baths_total ?? p.bathrooms} />
                <Row label="Total rooms"   value={char.rooms_total} />
                <Row label="Sqft (univ.)"  value={char.sqft_universal?.toLocaleString() ?? p.square_feet?.toLocaleString()} />
                <Row label="Sqft (living)" value={char.sqft_living?.toLocaleString()} />
                <Row label="Sqft (gross)"  value={char.sqft_gross?.toLocaleString()} />
                <Row label="Lot (acres)"   value={char.lot_acres} />
                <Row label="Lot (sqft)"    value={char.lot_sqft?.toLocaleString()} />
              </dl>
              <SubHead className="mt-3">Structure</SubHead>
              <dl className="space-y-1 text-sm">
                <Row label="Year built"      value={char.year_built ?? p.year_built} />
                <Row label="Year built eff." value={char.year_built_eff} />
                <Row label="Stories"         value={char.stories} />
                <Row label="Arch style"      value={char.arch_style} />
                <Row label="Quality"         value={char.quality} />
                <Row label="Construction"    value={char.construction} />
                <Row label="Frame type"      value={char.frame_type} />
                <Row label="Roof cover"      value={char.roof_cover} />
                <Row label="Roof shape"      value={char.roof_shape} />
                <Row label="Wall type"       value={char.wall_type} />
              </dl>
              <SubHead className="mt-3">Interior &amp; amenities</SubHead>
              <dl className="space-y-1 text-sm">
                <Row label="Garage type"    value={char.garage_type} />
                <Row label="Garage spaces"  value={char.garage_spaces} />
                <Row label="Pool"           value={char.pool} />
                <Row label="Pool type"      value={char.pool_type} />
                <Row label="Fireplaces"     value={char.fireplace_count} />
                <Row label="Fireplace type" value={char.fireplace_type} />
                <Row label="Heating"        value={char.heating} />
                <Row label="Cooling"        value={char.cooling} />
                <Row label="Fuel type"      value={char.fuel_type} />
                <Row label="Basement"       value={char.basement} />
                <Row label="Patio"          value={char.patio_type} />
                <Row label="Deck"           value={char.deck_ind} />
              </dl>
            </Section>

            <div className="space-y-4">
              {/* Owner info */}
              <Section title="Owner info" loading={loading && !hasReport}>
                <dl className="space-y-1 text-sm">
                  <RowFixed label="Owner 1"         value={own.owner1_name ?? p.owner_name} />
                  <RowFixed label="Owner 2"         value={own.owner2_name} />
                  <RowFixed label="Ownership type"  value={own.owner_type} />
                  <RowFixed label="Corporate"       value={own.corporate} />
                  <RowFixed label="Absentee status" value={own.absentee} />
                  <RowFixed label="Mailing address" value={own.mail_addr ?? p.owner_mailing_address} />
                </dl>
                <div className="mt-4 border-t pt-3">
                  <button onClick={doSkipTrace} disabled={tracing}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50 hover:bg-blue-700">
                    {tracing ? 'Running…' : 'Run skip trace'}
                  </button>
                  {traceErr && <p className="mt-2 text-sm text-red-600">{traceErr}</p>}
                  {trace && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm space-y-1">
                      <div>
                        <b>Phones: </b>
                        {sub.isActive
                          ? (trace.phones?.join(', ') || '—')
                          : <span className="blur-sm select-none pointer-events-none">{trace.phones?.map(() => '●●●-●●●-●●●●').join(', ') || '●●●-●●●-●●●●'}</span>}
                        {!sub.isActive && <span className="ml-2 text-xs text-indigo-600 font-medium">Upgrade to reveal</span>}
                      </div>
                      {trace.emails?.length > 0 && <div><b>Emails: </b>{trace.emails.join(', ')}</div>}
                    </div>
                  )}
                </div>
              </Section>

              {/* Mortgage */}
              <Section title="Mortgage info" loading={loading && !hasReport}>
                <dl className="space-y-1 text-sm">
                  <RowFixed label="Loan amount"   value={fmt$(mortg.amount)} />
                  <RowFixed label="Lender"        value={mortg.lender} />
                  <RowFixed label="Loan date"     value={mortg.date} />
                  <RowFixed label="Loan type"     value={mortg.loan_type} />
                  <RowFixed label="Deed type"     value={mortg.deed_type} />
                  <RowFixed label="Interest rate" value={fmtPct(mortg.interest_rate)} />
                  <RowFixed label="Rate type"     value={mortg.rate_type} />
                  <RowFixed label="Term"          value={mortg.term_months ? `${mortg.term_months} months` : null} />
                  <RowFixed label="Due date"      value={mortg.due_date} />
                  <RowFixed label="Title company" value={mortg.title_company} />
                </dl>
              </Section>
            </div>
          </div>

          {/* ── Valuation ─────────────────────────────────────────────────────── */}
          <Section title="Valuation &amp; assessment" loading={loading && !hasReport}>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <SubHead>AVM (automated)</SubHead>
                <dl className="space-y-1 text-sm">
                  <RowFixed label="Estimate"   value={fmt$(val.avm_value)} />
                  <RowFixed label="Low"        value={fmt$(val.avm_low)} />
                  <RowFixed label="High"       value={fmt$(val.avm_high)} />
                  <RowFixed label="Confidence" value={val.avm_confidence} />
                  <RowFixed label="As of"      value={val.avm_date} />
                </dl>
              </div>
              <div>
                <SubHead>Assessed</SubHead>
                <dl className="space-y-1 text-sm">
                  <RowFixed label="Land"  value={fmt$(val.assessed_land)} />
                  <RowFixed label="Total" value={fmt$(val.assessed_total)} />
                </dl>
                <SubHead className="mt-3">Market</SubHead>
                <dl className="space-y-1 text-sm">
                  <RowFixed label="Land"        value={fmt$(val.market_land)} />
                  <RowFixed label="Improvement" value={fmt$(val.market_impr)} />
                  <RowFixed label="Total"       value={fmt$(val.market_total)} />
                </dl>
              </div>
              <div>
                <SubHead>Appraised</SubHead>
                <dl className="space-y-1 text-sm">
                  <RowFixed label="Land"        value={fmt$(val.appraised_land)} />
                  <RowFixed label="Improvement" value={fmt$(val.appraised_impr)} />
                  <RowFixed label="Total"       value={fmt$(val.appraised_total)} />
                </dl>
                <SubHead className="mt-3">Taxes</SubHead>
                <dl className="space-y-1 text-sm">
                  <RowFixed label="Tax year"   value={val.tax_year} />
                  <RowFixed label="Tax amount" value={fmt$(val.tax_amount)} />
                </dl>
              </div>
            </div>
          </Section>

          {/* ── Location data ─────────────────────────────────────────────────── */}
          <Section title="Location data" loading={loading && !hasReport}>
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="space-y-1 text-sm">
                <RowFixed label="Full address" value={loc.address_full} />
                <RowFixed label="City"         value={loc.city ?? p.city} />
                <RowFixed label="State"        value={loc.state ?? p.state} />
                <RowFixed label="ZIP / ZIP+4"  value={loc.zip && loc.zip4 ? `${loc.zip}–${loc.zip4}` : loc.zip ?? p.zip} />
                <RowFixed label="Coordinates"  value={loc.lat && loc.lng ? `${(+loc.lat).toFixed(6)}, ${(+loc.lng).toFixed(6)}` : null} />
                <RowFixed label="Accuracy"     value={loc.accuracy} />
                <RowFixed label="Elevation"    value={loc.elevation != null ? `${loc.elevation} ft` : null} />
              </dl>
              <dl className="space-y-1 text-sm">
                <RowFixed label="FIPS"         value={loc.fips} />
                <RowFixed label="APN"          value={loc.apn} />
                <RowFixed label="County"       value={loc.county} />
                <RowFixed label="Municipality" value={loc.municipality} />
                <RowFixed label="Subdivision"  value={loc.subdivision} />
                <RowFixed label="School dist." value={loc.school_dist} />
              </dl>
            </div>
          </Section>

          {/* ── Transaction history ───────────────────────────────────────────── */}
          <Section title={`Transaction history${txns.length ? ` (${txns.length})` : ''}`} loading={loading && !hasReport}>
            {txns.length === 0 && hasReport
              ? <p className="text-sm text-gray-400">No recorded transactions found.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">Sale price</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">Deed</th>
                        <th className="pb-2 pr-4 font-medium">Seller</th>
                        <th className="pb-2 font-medium">Doc #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {txns.map((t, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-4 text-gray-700">{t.sale_date}</td>
                          <td className="py-2 pr-4 font-medium text-gray-900">{fmt$(t.sale_price) ?? '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{t.trans_type ?? '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{t.deed_type ?? '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{t.seller ?? '—'}</td>
                          <td className="py-2 text-gray-400 font-mono text-xs">{t.doc_num ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Section>

          {/* ── Building permits ──────────────────────────────────────────────── */}
          <Section title={`Building permits${permits.length ? ` (${permits.length})` : ''}`} loading={loading && !hasReport}>
            {permits.length === 0 && hasReport
              ? <p className="text-sm text-gray-400">No recorded permits found.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="pb-2 pr-3 font-medium">Date</th>
                        <th className="pb-2 pr-3 font-medium">Type</th>
                        <th className="pb-2 pr-3 font-medium">Description</th>
                        <th className="pb-2 pr-3 font-medium">Value</th>
                        <th className="pb-2 pr-3 font-medium">Contractor</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {permits.map((pm, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{pm.date}</td>
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{pm.type}</td>
                          <td className="py-2 pr-3 text-gray-500 max-w-xs">{pm.description}</td>
                          <td className="py-2 pr-3 text-gray-700">{pm.value ? fmt$(pm.value) : '—'}</td>
                          <td className="py-2 pr-3 text-gray-700">{pm.contractor ?? '—'}</td>
                          <td className="py-2"><StatusBadge status={pm.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Section>

          {/* ── Legacy ownership history from local DB ────────────────────────── */}
          {p.ownership_history?.length > 0 && (
            <Section title="Ownership history (local)">
              <ul className="space-y-2 text-sm">
                {p.ownership_history.map((h, i) => (
                  <li key={i} className="flex justify-between border-b pb-2 last:border-0">
                    <span>{h.owner}</span>
                    <span className="text-gray-500">{h.from} — {h.to || 'present'}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Section({ title, loading, children }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: title }} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {children}
    </div>
  );
}

function SubHead({ children, className = '' }) {
  return (
    <h3 className={`text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 ${className}`}>
      {children}
    </h3>
  );
}

function Row({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function RowFixed({ label, value }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className={`text-right font-medium ${empty ? 'text-gray-300' : 'text-gray-900'}`}>
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const s = status.toLowerCase();
  const cls = s === 'final'   ? 'bg-green-100 text-green-700'
            : s === 'issued'  ? 'bg-blue-100 text-blue-700'
            : s === 'expired' ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-600';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
