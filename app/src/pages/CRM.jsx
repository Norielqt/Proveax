import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listLeads, createLead, updateLead, deleteLead, SOURCE_TYPES, SOURCE_TYPE_LABELS } from '../api/leads';
import { TableSkeleton } from '../components/Skeleton';

// ── Helpers ───────────────────────────────────────────────────────────────
const SOURCE_TYPE_STYLE = {
  absentee_owner:     'bg-purple-100 text-purple-800',
  out_of_state_owner: 'bg-indigo-100 text-indigo-800',
  high_equity:        'bg-emerald-100 text-emerald-800',
  cash_buyers:        'bg-teal-100 text-teal-800',
  vacant_lots:        'bg-orange-100 text-orange-800',
  mls_active:         'bg-green-100 text-green-800',
  mls_pending:        'bg-yellow-100 text-yellow-800',
  mls_withdrawn:      'bg-red-100 text-red-800',
  mls_sold:           'bg-gray-100 text-gray-800',
};

function fmtPrice(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.round((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Editable cells ────────────────────────────────────────────────────────
function TextCell({ value, onCommit, type = 'text', placeholder = '' }) {
  const [draft, setDraft] = useState(value ?? '');
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    dirty.current = false;
    const next = draft === '' ? null : draft;
    if (next !== (value ?? null)) onCommit(next);
  };

  return (
    <input
      type={type}
      value={draft ?? ''}
      placeholder={placeholder}
      onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.currentTarget.blur(); }
        if (e.key === 'Escape') { dirty.current = false; setDraft(value ?? ''); e.currentTarget.blur(); }
      }}
      className="w-full border-0 bg-transparent px-2 py-1.5 text-center text-sm text-gray-800 outline-none focus:bg-blue-50/60 focus:ring-1 focus:ring-inset focus:ring-blue-400"
    />
  );
}

function PriceCell({ value, onCommit }) {
  const [draft, setDraft] = useState(value ?? '');
  const dirty = useRef(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!dirty.current) setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    dirty.current = false;
    setFocused(false);
    const raw = String(draft).replace(/[^\d.]/g, '');
    const next = raw === '' ? null : Number(raw);
    if (next !== (value ?? null)) onCommit(next);
  };

  const display = focused ? draft : fmtPrice(value);

  return (
    <input
      value={display ?? ''}
      placeholder="$0"
      onFocus={() => { setFocused(true); setDraft(value ?? ''); }}
      onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.currentTarget.blur(); }
        if (e.key === 'Escape') { dirty.current = false; setDraft(value ?? ''); e.currentTarget.blur(); }
      }}
      className="w-full border-0 bg-transparent px-2 py-1.5 text-center text-sm tabular-nums text-gray-800 outline-none focus:bg-blue-50/60 focus:ring-1 focus:ring-inset focus:ring-blue-400"
    />
  );
}

function SourceTypeCell({ value, onCommit }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onCommit(e.target.value || null)}
      className={`w-full border-0 bg-transparent px-2 py-1.5 text-center text-xs font-medium outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 ${value ? SOURCE_TYPE_STYLE[value] ?? 'text-gray-700' : 'text-gray-400'}`}
    >
      <option value="">—</option>
      {SOURCE_TYPES.map((t) => (
        <option key={t} value={t}>{SOURCE_TYPE_LABELS[t] ?? t}</option>
      ))}
    </select>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function CRM() {
  const [rows, setRows]         = useState(null);
  const [query, setQuery]       = useState('');
  const [saving, setSaving]     = useState({});
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await listLeads();
      setRows(data);
    } catch {
      setError('Failed to load leads.');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const patchRow = async (id, patch) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const fresh = await updateLead(id, patch);
      setRows((rs) => rs.map((r) => (r.id === id ? fresh : r)));
    } catch {
      setError('Save failed. Reloading…');
      load();
    } finally {
      setSaving((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  };

  const addRow = async () => {
    try {
      const fresh = await createLead({});
      setRows((rs) => [fresh, ...(rs ?? [])]);
    } catch {
      setError('Could not add row.');
    }
  };

  const removeRow = async (id) => {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    try { await deleteLead(id); }
    catch { setRows(prev); setError('Delete failed.'); }
  };

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      return [r.name, r.address, r.phone, r.email, r.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query]);

  const lastEdit = rows && rows.length
    ? rows.map((r) => r.updated_at).filter(Boolean).sort().slice(-1)[0]
    : null;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
          <p className="mt-1 text-sm text-gray-500">Shared lead spreadsheet. Changes save automatically.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          />
          <button
            onClick={addRow}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New lead
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error} <button className="underline" onClick={() => { setError(null); load(); }}>retry</button>
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {!filtered ? (
          <div className="p-4"><TableSkeleton rows={6} cols={7} /></div>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Th>Name</Th>
                <Th>Address</Th>
                <Th>Phone</Th>
                <Th>Lead</Th>
                <Th>Price</Th>
                <Th>Email</Th>
                <Th>Notes</Th>
                <Th className="w-20">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    {rows?.length === 0 ? 'No leads yet. Click + New lead to start.' : 'No leads match those filters.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="group hover:bg-gray-50/60">
                  <Td><TextCell value={r.name}    onCommit={(v) => patchRow(r.id, { name: v })}    placeholder="Name" /></Td>
                  <Td><TextCell value={r.address} onCommit={(v) => patchRow(r.id, { address: v })} placeholder="Address" /></Td>
                  <Td><TextCell value={r.phone}   onCommit={(v) => patchRow(r.id, { phone: v })}   placeholder="Phone" /></Td>
                  <Td><SourceTypeCell value={r.source_type} onCommit={(v) => patchRow(r.id, { source_type: v })} /></Td>
                  <Td><PriceCell value={r.home_price} onCommit={(v) => patchRow(r.id, { home_price: v })} /></Td>
                  <Td><TextCell value={r.email}   onCommit={(v) => patchRow(r.id, { email: v })}   placeholder="name@example.com" type="email" /></Td>
                  <Td><TextCell value={r.notes}   onCommit={(v) => patchRow(r.id, { notes: v })}   placeholder="Notes…" /></Td>
                  <Td>
                    <div className="flex items-center justify-center gap-1">
                      {saving[r.id] && <span className="text-[10px] text-gray-400">saving…</span>}
                      <button
                        onClick={() => removeRow(r.id)}
                        title="Delete lead"
                        className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered && filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          {filtered.length} of {rows.length} leads
          {lastEdit && <> · last edit {timeAgo(lastEdit)}</>}
        </p>
      )}
    </div>
  );
}

function Th({ children, className = '' }) {
  return <th className={`border-b border-gray-200 px-2 py-2 ${className}`}>{children}</th>;
}
function Td({ children, className = '' }) {
  return <td className={`align-middle text-center ${className}`}>{children}</td>;
}
