import React, { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { RefreshCw } from 'lucide-react';

export const AuditTrailView: React.FC = () => {
  const { setBreadcrumbs, showToast } = useAdmin();

  useEffect(() => {
    setBreadcrumbs([{ label: 'Platform' }, { label: 'Audit Trail' }]);
  }, [setBreadcrumbs]);

  const auditEvents = [
    {
      id: 1,
      actor: 'admin@jsango.dev',
      action: 'UPDATE',
      resource: 'Product #102',
      details: 'Updated price to 29.99 and status to published',
      ip: '127.0.0.1',
      time: '12 minutes ago',
    },
    {
      id: 2,
      actor: 'admin@jsango.dev',
      action: 'CREATE',
      resource: 'Page #4',
      details: 'Created new Terms of Service page',
      ip: '127.0.0.1',
      time: '45 minutes ago',
    },
    {
      id: 3,
      actor: 'admin@jsango.dev',
      action: 'AUTH_2FA_ENABLE',
      resource: 'Administrator #1',
      details: 'Activated TOTP Two-Factor Authentication',
      ip: '127.0.0.1',
      time: '1 hour ago',
    },
    {
      id: 4,
      actor: 'system',
      action: 'MIGRATION_RUN',
      resource: 'Schema v1.2',
      details: 'Applied migration 0002_create_pages_table.sql',
      ip: 'internal',
      time: '2 hours ago',
    },
    {
      id: 5,
      actor: 'admin@jsango.dev',
      action: 'DELETE',
      resource: 'Product #88',
      details: 'Deleted discontinued item',
      ip: '127.0.0.1',
      time: '5 hours ago',
    },
  ];

  const getActionBadge = (action: string) => {
    if (action.startsWith('CREATE')) return <span className="chakra-badge teal">{action}</span>;
    if (action.startsWith('DELETE')) return <span className="chakra-badge red">{action}</span>;
    if (action.startsWith('AUTH')) return <span className="chakra-badge purple">{action}</span>;
    return <span className="chakra-badge blue">{action}</span>;
  };

  return (
    <div style={{ maxWidth: 1000 }}>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Audit Trail & Security Logs</h1>
          <div style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
            Immutable record of administrative operations, data mutations, and security events
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="chakra-button subtle"
            onClick={() => showToast('Audit logs refreshed')}
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh Logs
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="chakra-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="chakra-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target Resource</th>
                <th>Operation Details</th>
                <th style={{ textAlign: 'right' }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((evt) => (
                <tr key={evt.id}>
                  <td style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', whiteSpace: 'nowrap' }}>
                    {evt.time}
                  </td>
                  <td style={{ fontWeight: 600 }}>{evt.actor}</td>
                  <td>{getActionBadge(evt.action)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--chakra-colors-brand-fg)' }}>{evt.resource}</td>
                  <td style={{ fontSize: '0.8125rem' }}>{evt.details}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--chakra-fonts-mono)', fontSize: '0.75rem' }}>
                    {evt.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
