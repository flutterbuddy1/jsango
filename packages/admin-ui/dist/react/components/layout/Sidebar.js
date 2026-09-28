import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAdmin } from '../../context/AdminContext.js';
import { LayoutDashboard, ShieldCheck, History, Cpu, UserCheck, Table, ShoppingBag, Users, FileText, Layers, Package, } from 'lucide-react';
const ICON_MAP = {
    'layout-dashboard': LayoutDashboard,
    'shield-check': ShieldCheck,
    history: History,
    cpu: Cpu,
    'user-check': UserCheck,
    table: Table,
    'shopping-bag': ShoppingBag,
    users: Users,
    'file-text': FileText,
    layers: Layers,
    package: Package,
};
export const Sidebar = () => {
    const { resources, route, setRoute, isMobileSidebarOpen, setMobileSidebarOpen } = useAdmin();
    // Group resources by navigationGroup
    const groups = {};
    for (const r of resources) {
        const groupName = r.navigationGroup || 'Models';
        if (!groups[groupName])
            groups[groupName] = [];
        groups[groupName].push(r);
    }
    const renderIcon = (iconName) => {
        const IconComponent = iconName && ICON_MAP[iconName] ? ICON_MAP[iconName] : Table;
        return _jsx(IconComponent, { style: { width: 15, height: 15 } });
    };
    const isNavActive = (targetHash) => {
        return route === targetHash || route.startsWith(targetHash + '/');
    };
    return (_jsxs(_Fragment, { children: [isMobileSidebarOpen && (_jsx("div", { className: "admin-sidebar-backdrop active", onClick: () => setMobileSidebarOpen(false) })), _jsxs("aside", { className: `admin-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`, children: [_jsxs("div", { children: [_jsx("div", { className: "nav-group-heading", children: "Core" }), _jsx("a", { href: "#dashboard", className: `nav-link-item ${route === '#dashboard' ? 'active' : ''}`, onClick: () => setMobileSidebarOpen(false), children: _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx(LayoutDashboard, { style: { width: 15, height: 15 } }), _jsx("span", { children: "Dashboard" })] }) })] }), Object.entries(groups).map(([groupName, items]) => (_jsxs("div", { children: [_jsx("div", { className: "nav-group-heading", children: groupName }), items.map((r) => {
                                const active = isNavActive(`#changelist/${r.id}`) || isNavActive(`#changeform/${r.id}`);
                                return (_jsxs("a", { href: `#changelist/${r.id}`, className: `nav-link-item ${active ? 'active' : ''}`, onClick: () => setMobileSidebarOpen(false), children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [renderIcon(r.navigationIcon), _jsx("span", { children: r.pluralLabel || r.label })] }), _jsx("button", { type: "button", className: "chakra-button ghost", style: { padding: '2px 6px', fontSize: 11, opacity: 0.7 }, title: `Add ${r.label}`, onClick: (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setRoute(`#changeform/${r.id}`);
                                                setMobileSidebarOpen(false);
                                            }, children: "+" })] }, r.id));
                            })] }, groupName))), _jsxs("div", { children: [_jsx("div", { className: "nav-group-heading", children: "Platform" }), _jsx("a", { href: "#profile", className: `nav-link-item ${route === '#profile' || route === '#password-change' ? 'active' : ''}`, onClick: () => setMobileSidebarOpen(false), children: _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx(UserCheck, { style: { width: 15, height: 15 } }), _jsx("span", { children: "Profile & Security" })] }) }), _jsx("a", { href: "#reports", className: `nav-link-item ${route === '#reports' ? 'active' : ''}`, onClick: () => setMobileSidebarOpen(false), children: _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx(ShoppingBag, { style: { width: 15, height: 15 } }), _jsx("span", { children: "Reports & Analytics" })] }) }), _jsx("a", { href: "#audit", className: `nav-link-item ${route === '#audit' ? 'active' : ''}`, onClick: () => setMobileSidebarOpen(false), children: _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx(History, { style: { width: 15, height: 15 } }), _jsx("span", { children: "Audit Trail" })] }) }), _jsx("a", { href: "#security", className: `nav-link-item ${route === '#security' ? 'active' : ''}`, onClick: () => setMobileSidebarOpen(false), children: _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx(ShieldCheck, { style: { width: 15, height: 15 } }), _jsx("span", { children: "Security & Roles" })] }) }), _jsx("a", { href: "#system", className: `nav-link-item ${route === '#system' ? 'active' : ''}`, onClick: () => setMobileSidebarOpen(false), children: _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx(Cpu, { style: { width: 15, height: 15 } }), _jsx("span", { children: "System Diagnostics" })] }) })] })] })] }));
};
//# sourceMappingURL=Sidebar.js.map