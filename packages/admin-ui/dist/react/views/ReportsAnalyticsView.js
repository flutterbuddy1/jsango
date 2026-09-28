import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { BarChart3, TrendingUp, Download, DollarSign, Users, ShoppingBag, RefreshCw, } from 'lucide-react';
export const ReportsAnalyticsView = () => {
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
    return (_jsxs("div", { style: { maxWidth: 1040 }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    gap: '1rem',
                }, children: [_jsxs("div", { children: [_jsx("h1", { style: { fontSize: '1.5rem', fontWeight: 800 }, children: "Reports & Executive Analytics" }), _jsx("div", { style: { fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }, children: "Aggregated business KPIs, revenue metrics, and resource volume indicators" })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsxs("button", { type: "button", className: "chakra-button subtle", onClick: () => showToast('Analytics recalculated'), children: [_jsx(RefreshCw, { style: { width: 14, height: 14 } }), " Refresh Data"] }), _jsxs("button", { type: "button", className: "chakra-button solid", onClick: handleExportReport, children: [_jsx(Download, { style: { width: 14, height: 14 } }), " Export Report"] })] })] }), _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                }, children: reportMetrics.map((kpi, idx) => {
                    const Icon = kpi.icon;
                    return (_jsxs("div", { className: "chakra-card", style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--chakra-colors-fg-muted)' }, children: kpi.label }), _jsx("div", { style: {
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: `${kpi.color}20`,
                                            color: kpi.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }, children: _jsx(Icon, { style: { width: 16, height: 16 } }) })] }), _jsx("div", { style: { fontSize: '1.5rem', fontWeight: 800 }, children: kpi.value }), _jsxs("div", { style: { fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("span", { style: { color: kpi.isPositive ? '#10b981' : '#ef4444', fontWeight: 700 }, children: kpi.change }), _jsx("span", { style: { color: 'var(--chakra-colors-fg-muted)' }, children: "vs previous month" })] })] }, idx));
                }) }), _jsxs("div", { className: "chakra-card", style: { marginBottom: '1.5rem' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }, children: [_jsx(BarChart3, { style: { width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' } }), _jsx("span", { children: "Resource Database Capacity & Distribution" })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }, children: resources.map((r) => (_jsxs("div", { style: {
                                background: 'var(--chakra-colors-bg-subtle)',
                                border: '1px solid var(--chakra-colors-border-subtle)',
                                borderRadius: 8,
                                padding: '0.875rem 1rem',
                            }, children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }, children: r.pluralLabel }), _jsxs("div", { style: { fontSize: '1.25rem', fontWeight: 800, marginTop: 4 }, children: [r.fields.length, " Fields"] }), _jsx("div", { style: { fontSize: '0.6875rem', color: 'var(--chakra-colors-brand-fg)', marginTop: 2, fontWeight: 600 }, children: "\u25CF Active ORM Table" })] }, r.id))) })] }), _jsxs("div", { className: "chakra-card", style: { padding: 0, overflow: 'hidden' }, children: [_jsx("div", { style: { padding: '1rem', borderBottom: '1px solid var(--chakra-colors-border-subtle)', fontWeight: 700 }, children: "Historical Performance Breakdown" }), _jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { className: "chakra-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Billing Period" }), _jsx("th", { children: "Orders Fulfilled" }), _jsx("th", { children: "Gross Revenue" }), _jsx("th", { children: "Registered Users" }), _jsx("th", { style: { textAlign: 'right' }, children: "Growth Rate" })] }) }), _jsx("tbody", { children: breakdownData.map((row, i) => (_jsxs("tr", { children: [_jsx("td", { style: { fontWeight: 600 }, children: row.period }), _jsx("td", { children: row.orders }), _jsx("td", { style: { fontWeight: 600, color: 'var(--chakra-colors-brand-fg)' }, children: row.revenue }), _jsx("td", { children: row.users }), _jsx("td", { style: { textAlign: 'right', fontWeight: 700, color: '#10b981' }, children: row.growth })] }, i))) })] }) })] })] }));
};
//# sourceMappingURL=ReportsAnalyticsView.js.map