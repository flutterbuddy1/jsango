import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

interface SystemHealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptime: number;
  memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  resourcesCount: number;
  pagesCount: number;
  activeSessions: number;
  services: Record<string, { status: 'up' | 'down'; label: string; subtext?: string }>;
}

const muted = 'var(--chakra-colors-fg-muted)';

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
}

/** Live process stats plus the app's health checks (database and any `healthChecks`). */
export const SystemDiagnosticsView: React.FC = () => {
  const { setBreadcrumbs, showToast, fetchApi } = useAdmin();
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchApi<{ health: SystemHealthData }>('/system/health');
      setHealth(res.health);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch diagnostics', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchApi, showToast]);

  useEffect(() => {
    setBreadcrumbs([{ label: 'Platform' }, { label: 'System' }]);
    load();
  }, [setBreadcrumbs, load]);

  const services = Object.entries(health?.services ?? {});
  const stats: Array<[string, string]> = health
    ? [
        ['Status', health.status === 'healthy' ? 'Healthy' : 'Degraded'],
        ['Uptime', formatUptime(health.uptime)],
        ['Node.js', health.nodeVersion],
        ['Platform', `${health.platform} (${health.arch})`],
        ['Process ID', String(health.pid)],
        ['Heap used / total', `${formatBytes(health.memory.heapUsed)} / ${formatBytes(health.memory.heapTotal)}`],
        ['Resident memory', formatBytes(health.memory.rss)],
        ['Models / pages', `${health.resourcesCount} / ${health.pagesCount}`],
        ['Active admin sessions', String(health.activeSessions)],
      ]
    : [];

  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>System</h1>
          <div style={{ fontSize: '0.8125rem', color: muted }}>
            {health ? `Checked ${new Date(health.timestamp).toLocaleTimeString()}` : 'Runtime vitals and health checks.'}
          </div>
        </div>
        <button type="button" className="chakra-button subtle" onClick={load} disabled={loading}>
          <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Checking…' : 'Run checks'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="chakra-card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Process</h2>
          {stats.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.45rem 0', borderBottom: '1px solid var(--chakra-colors-border-subtle)', fontSize: '0.8125rem' }}>
              <span style={{ color: muted }}>{label}</span>
              <span style={{ fontWeight: 600, fontFamily: 'var(--chakra-fonts-mono)' }}>{value}</span>
            </div>
          ))}
          {!health && <div style={{ color: muted, fontSize: '0.8125rem' }}>{loading ? 'Loading…' : 'No data.'}</div>}
        </div>

        <div className="chakra-card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Health checks</h2>
          {services.length === 0 && (
            <div style={{ color: muted, fontSize: '0.8125rem' }}>
              No checks configured. The database is checked automatically once one is configured; add your own with
              app.admin({'{'} healthChecks: {'{'} redis: () =&gt; redis.ping() {'}'} {'}'}).
            </div>
          )}
          {services.map(([name, svc]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid var(--chakra-colors-border-subtle)' }}>
              {svc.status === 'up' ? (
                <CheckCircle2 style={{ width: 16, height: 16, color: '#1baf7a', flexShrink: 0, marginTop: 2 }} aria-hidden />
              ) : (
                <XCircle style={{ width: 16, height: 16, color: '#e34948', flexShrink: 0, marginTop: 2 }} aria-hidden />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{svc.label}</div>
                {svc.subtext && <div style={{ fontSize: '0.75rem', color: muted, wordBreak: 'break-word' }}>{svc.subtext}</div>}
              </div>
              <span className={`chakra-badge ${svc.status === 'up' ? 'teal' : 'red'}`}>{svc.status === 'up' ? 'Up' : 'Down'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
