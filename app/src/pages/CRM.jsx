import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listLeads, createLead, updateLead, deleteLead, SOURCE_TYPES, SOURCE_TYPE_LABELS, uploadLeadFile, deleteLeadFile } from '../api/leads';
import { TableSkeleton } from '../components/Skeleton';

// ── Helpers ───────────────────────────────────────────────────────────────
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
  const ref = useRef(null);

  // Auto-resize textarea height to fit content
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    if (!dirty.current) setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    dirty.current = false;
    const next = draft === '' ? null : draft;
    if (next !== (value ?? null)) onCommit(next);
  };

  // email type isn't valid on textarea, we just use text behaviour
  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft ?? ''}
      placeholder={placeholder}
      onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { dirty.current = false; setDraft(value ?? ''); e.currentTarget.blur(); }
      }}
      className="w-full resize-none overflow-hidden border-0 bg-transparent px-3 py-2.5 text-left text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:bg-blue-50/60 focus:ring-1 focus:ring-inset focus:ring-blue-400"
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
      placeholder="No Data"
      onFocus={() => { setFocused(true); setDraft(value ?? ''); }}
      onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.currentTarget.blur(); }
        if (e.key === 'Escape') { dirty.current = false; setDraft(value ?? ''); e.currentTarget.blur(); }
      }}
      className="w-full border-0 bg-transparent px-3 py-2.5 text-left text-sm tabular-nums text-gray-800 outline-none placeholder:text-gray-400 focus:bg-blue-50/60 focus:ring-1 focus:ring-inset focus:ring-blue-400"
    />
  );
}

const SOURCE_TYPE_BADGE = {
  absentee_owner:     'bg-amber-100 text-amber-800',
  out_of_state_owner: 'bg-blue-100 text-blue-800',
  high_equity:        'bg-emerald-100 text-emerald-800',
  cash_buyers:        'bg-violet-100 text-violet-800',
  vacant_lots:        'bg-orange-100 text-orange-800',
  mls_withdrawn:      'bg-gray-100 text-gray-500',
};

function SourceTypeCell({ value, onCommit }) {
  return (
    <div className="relative min-h-[42px]">
      <select
        value={value ?? ''}
        onChange={(e) => onCommit(e.target.value || null)}
        className="absolute inset-0 w-full cursor-pointer border-0 bg-transparent opacity-0"
      >
        <option value="">No Data</option>
        {SOURCE_TYPES.map((t) => (
          <option key={t} value={t}>{SOURCE_TYPE_LABELS[t] ?? t}</option>
        ))}
      </select>
      <div className="pointer-events-none flex min-h-[42px] items-center px-3">
        {value ? (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SOURCE_TYPE_BADGE[value] ?? 'bg-gray-100 text-gray-600'}`}>
            {SOURCE_TYPE_LABELS[value] ?? value}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </div>
    </div>
  );
}

// ── File attachment cell (multi-file) ──────────────────────────────────
function FileCell({ leadId, files = [], onFileAdded, onFileDeleted, notify }) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const newFile = await uploadLeadFile(leadId, file);
      onFileAdded(newFile);
      notify('Uploaded successfully');
    } catch {
      notify('Upload failed. Please try again.', true);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Remove this file? This cannot be undone.')) return;
    setDeletingId(fileId);
    try {
      await deleteLeadFile(leadId, fileId);
      onFileDeleted(fileId);
      notify('Deleted successfully');
    } catch (err) {
      const msg = err?.response?.data || 'Delete failed. Please try again.';
      notify(typeof msg === 'string' ? msg : 'Delete failed. Please try again.', true);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-1 px-3 py-2 min-w-[140px]">
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-1">
          <svg className="h-3 w-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <a
            href={f.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[100px] truncate text-xs font-medium text-blue-600 hover:underline"
            title={f.file_name}
          >
            {f.file_name}
          </a>
          {deletingId === f.id ? (
            <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
          ) : (
            <button
              onClick={() => handleDelete(f.id)}
              title="Remove file"
              className="ml-auto rounded p-0.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <div>
        {uploading ? (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-0.5 rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        )}
        <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function CRM() {
  const [rows, setRows]         = useState(null);
  const [query, setQuery]       = useState('');
  const [saving, setSaving]     = useState({});
  const [error, setError]       = useState(null);
  const [toast, setToast]       = useState(null); // { message, error }

  const notify = useCallback((message, isError = false) => {
    setToast({ message, error: isError });
    setTimeout(() => setToast(null), 4000);
  }, []);

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

  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (!q) return true;
      return [r.name, r.address, r.phone, r.email, r.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

    if (!sort.key) return base;

    const LEAD_ORDER = [
      'absentee_owner', 'out_of_state_owner', 'high_equity',
      'cash_buyers', 'vacant_lots', 'mls_withdrawn',
    ];

    return [...base].sort((a, b) => {
      let av = a[sort.key];
      let bv = b[sort.key];

      if (sort.key === 'home_price') {
        av = av == null ? -Infinity : Number(av);
        bv = bv == null ? -Infinity : Number(bv);
        return sort.dir === 'asc' ? av - bv : bv - av;
      }

      if (sort.key === 'source_type') {
        const ai = LEAD_ORDER.indexOf(av ?? '');
        const bi = LEAD_ORDER.indexOf(bv ?? '');
        const an = ai === -1 ? 999 : ai;
        const bn = bi === -1 ? 999 : bi;
        return sort.dir === 'asc' ? an - bn : bn - an;
      }

      if (sort.key === 'phone') {
        const an = parseFloat(String(av ?? '').replace(/\D/g, '')) || Infinity;
        const bn = parseFloat(String(bv ?? '').replace(/\D/g, '')) || Infinity;
        return sort.dir === 'asc' ? an - bn : bn - an;
      }

      // alphabetical
      av = (av ?? '').toLowerCase();
      bv = (bv ?? '').toLowerCase();
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, query, sort]);

  const lastEdit = rows && rows.length
    ? rows.map((r) => r.updated_at).filter(Boolean).sort().slice(-1)[0]
    : null;

  return (
    <div className="p-4 md:p-8">
      {/* ── File toast notification ───────────────────────────────── */}
      {toast && (
        <div className="pointer-events-none fixed top-6 right-6 z-[9999]">
          <div className={`pointer-events-auto flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-2xl ring-1 ${
            toast.error ? 'bg-red-600 ring-red-500/40' : 'bg-green-600 ring-green-500/40'
          }`}>
            {toast.error ? (
              <svg className="h-5 w-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-semibold text-white">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 rounded-full p-0.5 text-white/70 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 pr-5">
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
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
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

      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 bg-white mx-5 shadow-sm">
        {!filtered ? (
          <div className="p-4"><TableSkeleton rows={6} cols={7} /></div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <SortableTh sortKey="name"        sort={sort} onSort={toggleSort}>Name</SortableTh>
                <SortableTh sortKey="address"     sort={sort} onSort={toggleSort}>Address</SortableTh>
                <SortableTh sortKey="phone"       sort={sort} onSort={toggleSort}>Phone</SortableTh>
                <SortableTh sortKey="source_type" sort={sort} onSort={toggleSort}>Lead</SortableTh>
                <SortableTh sortKey="home_price"  sort={sort} onSort={toggleSort}>Price</SortableTh>
                <SortableTh sortKey="email"       sort={sort} onSort={toggleSort}>Email</SortableTh>
                <Th>Notes</Th>
                <Th>File</Th>
                <Th className="w-20">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">
                    {rows?.length === 0 ? 'No leads yet. Click + New lead to start.' : 'No leads match those filters.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="group transition-colors hover:bg-indigo-50/30">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 select-none">
                        {r.name ? r.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                      </span>
                      <TextCell value={r.name} onCommit={(v) => patchRow(r.id, { name: v })} placeholder="No Data" />
                    </div>
                  </Td>
                  <Td><TextCell value={r.address} onCommit={(v) => patchRow(r.id, { address: v })} placeholder="No Data" /></Td>
                  <Td><TextCell value={r.phone}   onCommit={(v) => patchRow(r.id, { phone: v })}   placeholder="No Data" /></Td>
                  <Td><SourceTypeCell value={r.source_type} onCommit={(v) => patchRow(r.id, { source_type: v })} /></Td>
                  <Td><PriceCell value={r.home_price} onCommit={(v) => patchRow(r.id, { home_price: v })} /></Td>
                  <Td><TextCell value={r.email}   onCommit={(v) => patchRow(r.id, { email: v })}   placeholder="No Data" type="email" /></Td>
                  <Td><TextCell value={r.notes}   onCommit={(v) => patchRow(r.id, { notes: v })}   placeholder="No Data" /></Td>
                  <Td>
                    <FileCell
                      leadId={r.id}
                      files={r.files ?? []}
                      notify={notify}
                      onFileAdded={(newFile) =>
                        setRows((rs) => rs.map((x) =>
                          x.id === r.id ? { ...x, files: [...(x.files ?? []), newFile] } : x
                        ))
                      }
                      onFileDeleted={(fileId) =>
                        setRows((rs) => rs.map((x) =>
                          x.id === r.id ? { ...x, files: (x.files ?? []).filter((f) => f.id !== fileId) } : x
                        ))
                      }
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-center gap-1">
                      {saving[r.id] && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" title="Saving…" />}
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
        <p className="mt-3 text-xs text-gray-400 mx-5">
          {filtered.length} of {rows.length} leads
          {lastEdit && <> · last edit {timeAgo(lastEdit)}</>}
        </p>
      )}
    </div>
  );
}

function Th({ children, className = '' }) {
  return <th className={`border-b border-gray-200 px-4 py-3 ${className}`}>{children}</th>;
}
function Td({ children, className = '' }) {
  return <td className={`align-middle ${className}`}>{children}</td>;
}
function SortableTh({ children, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`border-b border-gray-200 px-4 py-3 cursor-pointer select-none hover:bg-gray-100 ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="text-[10px] text-gray-400">
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  );
}
