import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useAdmin } from './context/AdminContext.js';
import { AdminShell } from './components/layout/AdminShell.js';
import { DashboardView } from './views/DashboardView.js';
import { DataTable } from './components/data-table/DataTable.js';
import { DynamicForm } from './components/forms/DynamicForm.js';
import { ProfileSecurityView } from './views/ProfileSecurityView.js';
import { AuditTrailView } from './views/AuditTrailView.js';
import { SystemDiagnosticsView } from './views/SystemDiagnosticsView.js';
import { LoginView } from './views/LoginView.js';
export const AppContent = () => {
    const { route, resources } = useAdmin();
    // Route Dispatcher
    if (route.startsWith('#changelist/')) {
        const resourceId = route.replace('#changelist/', '');
        const res = resources.find((r) => r.id === resourceId);
        if (!res) {
            return (_jsxs("div", { className: "chakra-card", style: { padding: '2rem', textAlign: 'center' }, children: [_jsxs("h3", { children: ["Resource \"", resourceId, "\" not found"] }), _jsx("p", { style: { color: 'var(--chakra-colors-fg-muted)', fontSize: '0.8125rem', marginTop: 4 }, children: "Please make sure this resource is registered in your AdminRegistry." })] }));
        }
        return _jsx(DataTable, { resource: res }, res.id);
    }
    if (route.startsWith('#changeform/')) {
        const parts = route.replace('#changeform/', '').split('/');
        const resourceId = parts[0];
        const recordId = parts[1] || null;
        const res = resources.find((r) => r.id === resourceId);
        if (!res) {
            return (_jsx("div", { className: "chakra-card", style: { padding: '2rem', textAlign: 'center' }, children: _jsxs("h3", { children: ["Resource \"", resourceId, "\" not found"] }) }));
        }
        return _jsx(DynamicForm, { resource: res, recordId: recordId }, `${res.id}_${recordId || 'new'}`);
    }
    if (route === '#profile' || route === '#password-change' || route === '#security') {
        return _jsx(ProfileSecurityView, {});
    }
    if (route === '#audit') {
        return _jsx(AuditTrailView, {});
    }
    if (route === '#system') {
        return _jsx(SystemDiagnosticsView, {});
    }
    return _jsx(DashboardView, {});
};
export const AdminApp = () => {
    const { isAuthenticated } = useAdmin();
    if (!isAuthenticated) {
        return _jsx(LoginView, {});
    }
    return (_jsx(AdminShell, { children: _jsx(AppContent, {}) }));
};
//# sourceMappingURL=App.js.map