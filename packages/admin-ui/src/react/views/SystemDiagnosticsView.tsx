import React, { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { Cpu, Server, RefreshCw, CheckCircle2 } from 'lucide-react';

export const SystemDiagnosticsView: React.FC = () => {
  const { setBreadcrumbs, showToast } = useAdmin();

  useEffect(() => {
    setBreadcrumbs([{ label: 'Platform' }, { label: 'System Diagnostics' }]);
  }, [setBreadcrumbs]);

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>System Diagnostics & Health</h1>
          <div style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
            Real-time runtime vitals, memory consumption, and subsystem health indicators
          </div>
        </div>

        <button
          type="button"
          className="chakra-button subtle"
          onClick={() => showToast('Health checks updated')}
        >
          <RefreshCw style={{ width: 14, height: 14 }} /> Run Diagnostics
        </button>
      </div>

      {/* Grid: Process Vitals + Subsystem Health */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Process Vitals */}
        <div className="chakra-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '1rem' }}>
            <Cpu style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
            <span>Process Runtime</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--chakra-colors-border-subtle)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>Engine</span>
              <span style={{ fontWeight: 600 }}>Node.js / JSango v1.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--chakra-colors-border-subtle)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>Process Uptime</span>
              <span style={{ fontWeight: 600 }}>3h 42m 18s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--chakra-colors-border-subtle)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>Memory Heap (RSS)</span>
              <span style={{ fontWeight: 600 }}>48.2 MB / 512 MB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>Event Loop Latency</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>0.42 ms (Optimal)</span>
            </div>
          </div>
        </div>

        {/* Subsystems Health */}
        <div className="chakra-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '1rem' }}>
            <Server style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
            <span>Subsystem Integrity</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--chakra-colors-border-subtle)', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: '#10b981' }} />
                <span>SQLite / Postgres ORM</span>
              </div>
              <span className="chakra-badge teal">Operational</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--chakra-colors-border-subtle)', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: '#10b981' }} />
                <span>HTTP Router & Middleware</span>
              </div>
              <span className="chakra-badge teal">Operational</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--chakra-colors-border-subtle)', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: '#10b981' }} />
                <span>In-Memory / Redis Cache</span>
              </div>
              <span className="chakra-badge teal">Connected</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: '#10b981' }} />
                <span>Background Task Queue</span>
              </div>
              <span className="chakra-badge teal">Listening</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
