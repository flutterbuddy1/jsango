import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAdmin } from '../../context/AdminContext.js';
import { Topbar } from './Topbar.js';
import { Sidebar } from './Sidebar.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
export const AdminShell = ({ children }) => {
    const { toasts, removeToast } = useAdmin();
    const getToastIcon = (type) => {
        switch (type) {
            case 'success':
                return _jsx(CheckCircle, { style: { width: 16, height: 16, color: '#10b981' } });
            case 'error':
                return _jsx(AlertCircle, { style: { width: 16, height: 16, color: '#ef4444' } });
            case 'warning':
                return _jsx(AlertTriangle, { style: { width: 16, height: 16, color: '#f59e0b' } });
            default:
                return _jsx(Info, { style: { width: 16, height: 16, color: '#0ea5e9' } });
        }
    };
    return (_jsxs("div", { className: "admin-shell", children: [_jsx(Topbar, {}), _jsx(Breadcrumbs, {}), _jsxs("div", { className: "admin-body", children: [_jsx(Sidebar, {}), _jsx("main", { className: "admin-content", id: "admin-viewport", children: children })] }), _jsx("div", { className: "admin-toast-container", children: toasts.map((toast) => (_jsxs("div", { className: "chakra-toast", role: "alert", children: [getToastIcon(toast.type), _jsx("div", { style: { flex: 1, fontSize: '0.8125rem' }, children: toast.text }), _jsx("button", { type: "button", className: "chakra-button ghost", style: { padding: 2, minWidth: 20, height: 20 }, onClick: () => removeToast(toast.id), children: _jsx(X, { style: { width: 14, height: 14 } }) })] }, toast.id))) })] }));
};
//# sourceMappingURL=AdminShell.js.map