import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { Layers, Database, Activity, ShieldCheck, Plus, ArrowRight, TrendingUp, Clock, CheckCircle2, } from 'lucide-react';
export const DashboardView = () => {
    const { resources, setRoute, setBreadcrumbs, showToast } = useAdmin();
    useEffect(() => {
        setBreadcrumbs([{ label: 'Dashboard' }]);
    }, [setBreadcrumbs]);
    return (_jsxs("div", { children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                }, children: [_jsxs("div", { children: [_jsx("h1", { style: { fontSize: '1.625rem', fontWeight: 800 }, children: "Administration Dashboard" }), _jsx("div", { style: { fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }, children: "Welcome to the JSango Administration console. Manage database models, audit logs, and security." })] }), _jsx("div", { style: { display: 'flex', gap: '0.5rem' }, children: _jsxs("button", { type: "button", className: "chakra-button subtle", onClick: () => showToast('Dashboard metrics refreshed'), children: [_jsx(Activity, { style: { width: 14, height: 14 } }), " Refresh"] }) })] }), _jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                }, children: [_jsxs("div", { className: "chakra-card", style: { display: 'flex', alignItems: 'center', gap: '1rem' }, children: [_jsx("div", { style: {
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    background: 'var(--chakra-colors-brand-subtle)',
                                    color: 'var(--chakra-colors-brand-solid)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }, children: _jsx(Layers, { style: { width: 22, height: 22 } }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }, children: "Registered Models" }), _jsx("div", { style: { fontSize: '1.375rem', fontWeight: 800 }, children: resources.length })] })] }), _jsxs("div", { className: "chakra-card", style: { display: 'flex', alignItems: 'center', gap: '1rem' }, children: [_jsx("div", { style: {
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }, children: _jsx(Database, { style: { width: 22, height: 22 } }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }, children: "ORM Connection" }), _jsx("div", { style: { fontSize: '1.125rem', fontWeight: 800, color: '#10b981' }, children: "Active / Ready" })] })] }), _jsxs("div", { className: "chakra-card", style: { display: 'flex', alignItems: 'center', gap: '1rem' }, children: [_jsx("div", { style: {
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    color: '#3b82f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }, children: _jsx(ShieldCheck, { style: { width: 22, height: 22 } }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }, children: "Auth Security Status" }), _jsx("div", { style: { fontSize: '1.125rem', fontWeight: 800, color: '#3b82f6' }, children: "2FA Protected" })] })] }), _jsxs("div", { className: "chakra-card", style: { display: 'flex', alignItems: 'center', gap: '1rem' }, children: [_jsx("div", { style: {
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    background: 'rgba(168, 85, 247, 0.15)',
                                    color: '#a855f7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }, children: _jsx(TrendingUp, { style: { width: 22, height: 22 } }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', fontWeight: 600 }, children: "System Uptime" }), _jsx("div", { style: { fontSize: '1.125rem', fontWeight: 800 }, children: "99.99%" })] })] })] }), _jsxs("div", { style: { marginBottom: '1.5rem' }, children: [_jsx("h2", { style: { fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.875rem' }, children: "Database Models & Entities" }), _jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1rem',
                        }, children: resources.map((res) => (_jsxs("div", { className: "chakra-card", style: {
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'transform 0.15s ease, border-color 0.15s ease',
                            }, onClick: () => setRoute(`#changelist/${res.id}`), children: [_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }, children: [_jsx("div", { style: { fontWeight: 700, fontSize: '1rem' }, children: res.pluralLabel || res.label }), _jsxs("span", { className: "chakra-badge teal", children: [res.fields.length, " Fields"] })] }), _jsxs("p", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1rem' }, children: ["Group: ", _jsx("strong", { children: res.navigationGroup || 'Models' })] })] }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingTop: '0.75rem',
                                        borderTop: '1px solid var(--chakra-colors-border-subtle)',
                                    }, children: [_jsxs("button", { type: "button", className: "chakra-button ghost", style: { padding: '2px 6px', fontSize: '0.75rem' }, onClick: (e) => {
                                                e.stopPropagation();
                                                setRoute(`#changeform/${res.id}`);
                                            }, children: [_jsx(Plus, { style: { width: 13, height: 13 } }), " Add"] }), _jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 3,
                                                fontSize: '0.75rem',
                                                color: 'var(--chakra-colors-brand-fg)',
                                                fontWeight: 600,
                                            }, children: [_jsx("span", { children: "View Changelist" }), _jsx(ArrowRight, { style: { width: 12, height: 12 } })] })] })] }, res.id))) })] }), _jsxs("div", { className: "chakra-card", children: [_jsx("h2", { style: { fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }, children: "Recent Admin Activity Log" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }, children: [_jsx(CheckCircle2, { style: { width: 16, height: 16, color: '#10b981' } }), _jsxs("span", { children: [_jsx("strong", { children: "admin@jsango.dev" }), " updated site settings configuration"] }), _jsx("span", { style: { marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }, children: "10 mins ago" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }, children: [_jsx(CheckCircle2, { style: { width: 16, height: 16, color: '#10b981' } }), _jsxs("span", { children: [_jsx("strong", { children: "admin@jsango.dev" }), " created new Page record"] }), _jsx("span", { style: { marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }, children: "35 mins ago" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }, children: [_jsx(Clock, { style: { width: 16, height: 16, color: '#0ea5e9' } }), _jsxs("span", { children: [_jsx("strong", { children: "System" }), " executed automatic database schema check"] }), _jsx("span", { style: { marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }, children: "2 hours ago" })] })] })] })] }));
};
//# sourceMappingURL=DashboardView.js.map