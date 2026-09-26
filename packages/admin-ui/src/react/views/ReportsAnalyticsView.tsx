import React, { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import {
  BarChart3,
  TrendingUp,
  Download,
  DollarSign,
  Users,
  ShoppingBag,
  RefreshCw,
} from 'lucide-react';

export const ReportsAnalyticsView: React.FC = () => {
  const { resources, setBreadcrumbs, showToast } = useAdmin();

  useEffect(() => {
    setBreadcrumbs([{ label: 'Platform' }, { label: 'Reports & Analytics' }]);
  }, [setBreadcrumbs]);

  const reportMetrics = [
    {
      label: 'Monthly Gross Volume',
      value: '$48,290.00',
      change: '+14.2%',
      isPositive: true,
      icon: DollarSign,
      color: '#10b981',
    },
    {
      label: 'New Customer Signups',
      value: '1,280',
      change: '+8.4%',
      isPositive: true,
      icon: Users,
      color: '#3b82f6',
    },
    {
      label: 'Fulfilled Orders',
      value: '642',
      change: '+22.1%',
      isPositive: true,
      icon: ShoppingBag,
      color: '#a855f7',
    },
    {
      label: 'Average Order Value',
      value: '$75.20',
      change: '-1.5%',
      isPositive: false,
      icon: TrendingUp,
      color: '#f59e0b',
    },
  ];

  const breakdownData = [
    { period: 'September 2026', orders: 642, revenue: '$48,290.00', users: 1280, growth: '+18.4%' },
    { period: 'August 2026', orders: 526, revenue: '$42,300.50', users: 1120, growth: '+12.1%' },
    { period: 'July 2026', orders: 469, revenue: '$37,720.00', users: 998, growth: '+9.8%' },
    { period: 'June 2026', orders: 428, revenue: '$34,350.00', users: 910, growth: '+15.2%' },
    { period: 'May 2026', orders: 371, revenue: '$29,810.00', users: 790, growth: '+7.4%' },
  ];

  const handleExportReport = () => {
    const headers = 'Period,Orders,Revenue,Users,Growth\n';
    const rows = breakdownData.map((d) => `"${d.period}",${d.orders},"${d.revenue}",${d.users},"${d.growth}"`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_analytics_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Analytics report exported as CSV');
  };

  return (
    <div style={{ maxWidth: 1040 }}>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Reports & Executive Analytics</h1>
          <div style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
            Aggregated business KPIs, revenue metrics, and resource volume indicators
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="chakra-button subtle"
            onClick={() => showToast('Analytics recalculated')}
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh Data
          </button>
          <button type="button" className="chakra-button solid" onClick={handleExportReport}>
            <Download style={{ width: 14, height: 14 }} /> Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {reportMetrics.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="chakra-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--chakra-colors-fg-muted)' }}>
                  {kpi.label}
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${kpi.color}20`,
                    color: kpi.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon style={{ width: 16, height: 16 }} />
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: kpi.isPositive ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  {kpi.change}
                </span>
                <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>vs previous month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resource Volume Distribution */}
      <div className="chakra-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>
          <BarChart3 style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
          <span>Resource Database Capacity & Distribution</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {resources.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'var(--chakra-colors-bg-subtle)',
                border: '1px solid var(--chakra-colors-border-subtle)',
                borderRadius: 8,
                padding: '0.875rem 1rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }}>
                {r.pluralLabel}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 4 }}>{r.fields.length} Fields</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--chakra-colors-brand-fg)', marginTop: 2, fontWeight: 600 }}>
                ● Active ORM Table
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Breakdown Data Table */}
      <div className="chakra-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--chakra-colors-border-subtle)', fontWeight: 700 }}>
          Historical Performance Breakdown
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="chakra-table">
            <thead>
              <tr>
                <th>Billing Period</th>
                <th>Orders Fulfilled</th>
                <th>Gross Revenue</th>
                <th>Registered Users</th>
                <th style={{ textAlign: 'right' }}>Growth Rate</th>
              </tr>
            </thead>
            <tbody>
              {breakdownData.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{row.period}</td>
                  <td>{row.orders}</td>
                  <td style={{ fontWeight: 600, color: 'var(--chakra-colors-brand-fg)' }}>{row.revenue}</td>
                  <td>{row.users}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{row.growth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
