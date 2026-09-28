import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { RefreshCw } from 'lucide-react';
export const AuditTrailView = () => {
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
    const getActionBadge = (action) => {
        if (action.startsWith('CREATE'))
            return _jsx("span", { className: "chakra-badge teal", children: action });
        if (action.startsWith('DELETE'))
            return _jsx("span", { className: "chakra-badge red", children: action });
        if (action.startsWith('AUTH'))
            return _jsx("span", { className: "chakra-badge purple", children: action });
        return _jsx("span", { className: "chakra-badge blue", children: action });
    };
    return (_jsxs("div", { style: { maxWidth: 1000 }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    gap: '1rem',
                }, children: [_jsxs("div", { children: [_jsx("h1", { style: { fontSize: '1.5rem', fontWeight: 800 }, children: "Audit Trail & Security Logs" }), _jsx("div", { style: { fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }, children: "Immutable record of administrative operations, data mutations, and security events" })] }), _jsx("div", { style: { display: 'flex', gap: '0.5rem' }, children: _jsxs("button", { type: "button", className: "chakra-button subtle", onClick: () => showToast('Audit logs refreshed'), children: [_jsx(RefreshCw, { style: { width: 14, height: 14 } }), " Refresh Logs"] }) })] }), _jsx("div", { className: "chakra-card", style: { padding: 0, overflow: 'hidden' }, children: _jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { className: "chakra-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Timestamp" }), _jsx("th", { children: "Actor" }), _jsx("th", { children: "Action" }), _jsx("th", { children: "Target Resource" }), _jsx("th", { children: "Operation Details" }), _jsx("th", { style: { textAlign: 'right' }, children: "IP Address" })] }) }), _jsx("tbody", { children: auditEvents.map((evt) => (_jsxs("tr", { children: [_jsx("td", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', whiteSpace: 'nowrap' }, children: evt.time }), _jsx("td", { style: { fontWeight: 600 }, children: evt.actor }), _jsx("td", { children: getActionBadge(evt.action) }), _jsx("td", { style: { fontWeight: 600, color: 'var(--chakra-colors-brand-fg)' }, children: evt.resource }), _jsx("td", { style: { fontSize: '0.8125rem' }, children: evt.details }), _jsx("td", { style: { textAlign: 'right', fontFamily: 'var(--chakra-fonts-mono)', fontSize: '0.75rem' }, children: evt.ip })] }, evt.id))) })] }) }) })] }));
};
//# sourceMappingURL=AuditTrailView.js.map