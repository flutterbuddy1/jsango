import React, { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import {
  Layers,
  Database,
  Activity,
  ShieldCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { resources, setRoute, setBreadcrumbs, showToast } = useAdmin();

  useEffect(() => {
    setBreadcrumbs([{ label: 'Dashboard' }]);
  }, [setBreadcrumbs]);

  return (
    <div>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800 }}>Administration Dashboard</h1>
          <div style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
            Welcome to the JSango Administration console. Manage database models, audit logs, and security.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="chakra-button subtle"
            onClick={() => showToast('Dashboard metrics refreshed')}
          >
            <Activity style={{ width: 14, height: 14 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Metric 1 */}
        <div className="chakra-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--chakra-colors-brand-subtle)',
              color: 'var(--chakra-colors-brand-solid)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }}>
              Registered Models
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800 }}>{resources.length}</div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="chakra-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Database style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }}>
              ORM Connection
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#10b981' }}>Active / Ready</div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="chakra-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }}>
              Auth Security Status
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#3b82f6' }}>2FA Protected</div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="chakra-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }}>
              System Uptime
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>99.99%</div>
          </div>
        </div>
      </div>

      {/* Models Directory Grid */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.875rem' }}>
          Database Models & Entities
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {resources.map((res) => (
            <div
              key={res.id}
              className="chakra-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
              onClick={() => setRoute(`#changelist/${res.id}`)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{res.pluralLabel || res.label}</div>
                  <span className="chakra-badge teal">{res.fields.length} Fields</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1rem' }}>
                  Group: <strong>{res.navigationGroup || 'Models'}</strong>
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--chakra-colors-border-subtle)',
                }}
              >
                <button
                  type="button"
                  className="chakra-button ghost"
                  style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRoute(`#changeform/${res.id}`);
                  }}
                >
                  <Plus style={{ width: 13, height: 13 }} /> Add
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: '0.75rem',
                    color: 'var(--chakra-colors-brand-fg)',
                    fontWeight: 600,
                  }}
                >
                  <span>View Changelist</span>
                  <ArrowRight style={{ width: 12, height: 12 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Card */}
      <div className="chakra-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Recent Admin Activity Log
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981' }} />
            <span>
              <strong>admin@jsango.dev</strong> updated site settings configuration
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }}>
              10 mins ago
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981' }} />
            <span>
              <strong>admin@jsango.dev</strong> created new Page record
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }}>
              35 mins ago
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <Clock style={{ width: 16, height: 16, color: '#0ea5e9' }} />
            <span>
              <strong>System</strong> executed automatic database schema check
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }}>
              2 hours ago
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
