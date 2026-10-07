import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { RefreshCw } from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceId: string;
  resourceLabel?: string;
  objectId?: string;
  objectRepresentation?: string;
  actor?: { id: string; email?: string; username?: string };
  changes?: Array<{ field: string; before: unknown; after: unknown }>;
  ipAddress?: string;
}

const PAGE_SIZE = 50;
const ACTIONS = ['create', 'update', 'delete', 'restore', 'action', 'bulk_action', 'export', 'login', 'logout'];
const BADGE: Record<string, string> = { create: 'teal', delete: 'red', bulk_action: 'red', login: 'purple', logout: 'purple', export: 'gray' };
const muted = 'var(--chakra-colors-fg-muted)';

const show = (v: unknown) => (v === undefined || v === null ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** The real audit log (`GET /audit`), newest first, filterable by resource and action. */
export const AuditTrailView: React.FC = () => {
  const { setBreadcrumbs, fetchApi, showToast, resources } = useAdmin();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [resourceId, setResourceId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: 'Platform' }, { label: 'Audit Trail' }]);
  }, [setBreadcrumbs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (resourceId) params.set('resourceId', resourceId);
      if (action) params.set('action', action);
      const page = await fetchApi<{ entries: AuditEntry[]; total: number }>(`/audit?${params}`);
      setEntries(page.entries ?? []);
      setTotal(page.total ?? 0);
    } catch (err: any) {
      showToast(err.message || 'Failed to load the audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchApi, showToast, offset, resourceId, action]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Audit Trail</h1>
          <div style={{ fontSize: '0.8125rem', color: muted }}>Every change made through the admin: who, what, when and from where.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select className="chakra-input" style={{ width: 'auto' }} value={resourceId} onChange={(e) => { setResourceId(e.target.value); setOffset(0); }} aria-label="Resource">
            <option value="">All resources</option>
            <option value="auth">Sign-ins</option>
            <option value="auth_security">Account security</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.pluralLabel || r.label}</option>)}
          </select>
          <select className="chakra-input" style={{ width: 'auto' }} value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }} aria-label="Action">
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
          </select>
          <button type="button" className="chakra-button subtle" onClick={load} disabled={loading}>
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      <div className="chakra-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="chakra-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Changes</th><th>IP</th></tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={6} style={{ color: muted, textAlign: 'center', padding: '2rem' }}>{loading ? 'Loading…' : 'No audit entries yet.'}</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleString()}</td>
                <td>{e.actor?.email ?? e.actor?.username ?? e.actor?.id ?? 'system'}</td>
                <td><span className={`chakra-badge ${BADGE[e.action] ?? 'blue'}`}>{e.action.replace('_', ' ')}</span></td>
                <td>
                  {e.resourceLabel ?? e.resourceId}
                  {e.objectId ? ` #${e.objectId}` : ''}
                  {e.objectRepresentation ? <span style={{ color: muted }}> {e.objectRepresentation}</span> : null}
                </td>
                <td style={{ fontSize: '0.75rem', maxWidth: 360 }}>
                  {(e.changes ?? []).map((c) => (
                    <div key={c.field}>
                      <strong>{c.field}</strong>: <span style={{ color: muted }}>{show(c.before)}</span> → {show(c.after)}
                    </div>
                  ))}
                </td>
                <td style={{ fontFamily: 'var(--chakra-fonts-mono)', fontSize: '0.75rem' }}>{e.ipAddress ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8125rem', color: muted }}>
        <span>{total === 0 ? '0 entries' : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total.toLocaleString()}`}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="chakra-button outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button>
          <button type="button" className="chakra-button outline" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button>
        </div>
      </div>
    </div>
  );
};
