import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
const AdminContext = createContext(null);
export function useAdmin() {
    const ctx = useContext(AdminContext);
    if (!ctx) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return ctx;
}
export const AdminProvider = ({ config: userConfig, initialUser, children, }) => {
    const mergedConfig = {
        title: userConfig?.title || 'JSango Administration',
        brandSubtitle: userConfig?.brandSubtitle || 'Enterprise Admin Control',
        siteUrl: userConfig?.siteUrl || '/',
        apiBasePath: (userConfig?.apiBasePath || userConfig?.apiPrefix || '/api/admin').replace(/\/$/, ''),
        defaultTheme: userConfig?.defaultTheme || 'dark',
        enableCommandPalette: userConfig?.enableCommandPalette ?? true,
        enableTwoFactor: userConfig?.enableTwoFactor ?? true,
    };
    const [theme, setThemeState] = useState(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('jsango_admin_theme') : null;
        if (saved === 'light' || saved === 'dark')
            return saved;
        return mergedConfig.defaultTheme === 'light' ? 'light' : 'dark';
    });
    const [authToken, setAuthToken] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('jsango_admin_token');
        }
        return null;
    });
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState({
        id: initialUser?.id || 'usr-admin-01',
        name: initialUser?.name || 'System Administrator',
        email: initialUser?.email || 'admin@jsango.dev',
        role: initialUser?.role || 'Superuser',
        isSuperuser: initialUser?.isSuperuser ?? true,
        avatarUrl: initialUser?.avatarUrl,
        lastLoginAt: initialUser?.lastLoginAt || new Date().toISOString(),
    });
    const [resources, setResources] = useState([]);
    const [route, setRouteState] = useState(() => {
        if (typeof window !== 'undefined' && window.location.hash) {
            return window.location.hash;
        }
        return '#dashboard';
    });
    const [toasts, setToasts] = useState([]);
    const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [breadcrumbs, setBreadcrumbs] = useState([
        { label: 'Dashboard', href: '#dashboard' },
    ]);
    const setTheme = useCallback((newTheme) => {
        setThemeState(newTheme);
        if (typeof window !== 'undefined') {
            localStorage.setItem('jsango_admin_theme', newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
        }
    }, []);
    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }, [theme]);
    const setRoute = useCallback((newRoute) => {
        setRouteState(newRoute);
        if (typeof window !== 'undefined' && window.location.hash !== newRoute) {
            window.location.hash = newRoute;
        }
    }, []);
    useEffect(() => {
        const handleHashChange = () => {
            setRouteState(window.location.hash || '#dashboard');
            setMobileSidebarOpen(false);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);
    const showToast = useCallback((text, type = 'success') => {
        const id = 'toast_' + Math.random().toString(36).slice(2, 9);
        setToasts((prev) => [...prev, { id, text, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    const fetchApi = useCallback(async (endpoint, init) => {
        const url = `${mergedConfig.apiBasePath}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(init?.headers || {}),
        };
        const currentToken = authToken || (typeof window !== 'undefined' ? localStorage.getItem('jsango_admin_token') : null);
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        const res = await fetch(url, {
            ...init,
            headers,
        });
        if (res.status === 204) {
            return {};
        }
        const text = await res.text();
        let body = null;
        if (text && text.trim().length > 0) {
            try {
                body = JSON.parse(text);
            }
            catch {
                body = text;
            }
        }
        if (!res.ok) {
            if (res.status === 401 && endpoint !== '/auth/login') {
                setIsAuthenticated(false);
                setAuthToken(null);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('jsango_admin_token');
                }
            }
            let errMessage = `HTTP ${res.status} ${res.statusText}`;
            if (body && typeof body === 'object' && body.error) {
                errMessage = typeof body.error === 'string' ? body.error : body.error.message || errMessage;
            }
            throw new Error(errMessage);
        }
        return (body ?? {});
    }, [mergedConfig.apiBasePath, authToken]);
    const login = useCallback(async (email, password, totpCode) => {
        const res = await fetchApi('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, totpCode }),
        });
        const data = res?.data || res;
        if (data?.requires2fa) {
            return { ok: false, requires2fa: true };
        }
        if (data?.token && data?.user) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('jsango_admin_token', data.token);
            }
            setAuthToken(data.token);
            setUser({
                id: data.user.id,
                name: data.user.name || 'System Administrator',
                email: data.user.email || email,
                role: data.user.role || 'Superuser',
                isSuperuser: data.user.isSuperuser ?? true,
            });
            setIsAuthenticated(true);
            return { ok: true, token: data.token, user: data.user };
        }
        throw new Error(data?.message || 'Login failed.');
    }, [fetchApi]);
    const logout = useCallback(async () => {
        try {
            await fetchApi('/auth/logout', { method: 'POST' }).catch(() => { });
        }
        finally {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('jsango_admin_token');
            }
            setAuthToken(null);
            setIsAuthenticated(false);
            setRoute('#dashboard');
        }
    }, [fetchApi, setRoute]);
    // Check auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
            const savedToken = typeof window !== 'undefined' ? localStorage.getItem('jsango_admin_token') : null;
            if (!savedToken) {
                setIsAuthenticated(false);
                return;
            }
            try {
                const res = await fetchApi('/auth/me');
                const userData = res?.data?.user || res?.user;
                if (userData) {
                    setUser({
                        id: userData.id,
                        name: userData.name || userData.username || 'System Administrator',
                        email: userData.email || userData.username || 'admin@jsango.dev',
                        role: userData.roles?.[0] || 'Superuser',
                        isSuperuser: userData.isSuperuser ?? true,
                    });
                    setIsAuthenticated(true);
                }
            }
            catch {
                setIsAuthenticated(false);
                setAuthToken(null);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('jsango_admin_token');
                }
            }
        };
        checkAuth();
    }, [fetchApi]);
    const refreshResources = useCallback(async () => {
        try {
            const res = await fetchApi('/resources');
            const rawResources = res?.data?.resources || res?.resources || [];
            if (Array.isArray(rawResources)) {
                const fullResources = await Promise.all(rawResources.map(async (r) => {
                    try {
                        const schemaRes = await fetchApi(`/resources/${r.id}/schema`);
                        const schema = schemaRes?.data?.schema || schemaRes?.schema || {};
                        const fields = (schema.fields || []).map((f) => ({
                            name: f.name,
                            label: f.label || f.name,
                            type: f.type === 'datetime'
                                ? 'date'
                                : f.type === 'text' || f.type === 'uuid'
                                    ? 'string'
                                    : f.type === 'file' || f.type === 'image'
                                        ? f.type
                                        : f.type === 'relation' || f.name.endsWith('Id') || f.foreignKey
                                            ? 'relation'
                                            : f.type,
                            required: f.required,
                            readOnly: f.readonly,
                            choices: f.enumChoices || f.choices,
                            helpText: f.helpText,
                            relatedResource: f.relatedResource || f.foreignKey?.resource || (f.name.endsWith('Id') ? f.name.replace(/Id$/, 's') : undefined),
                        }));
                        const listDisplay = schema.listFields ||
                            schema.listDisplay ||
                            (fields.length > 0 ? fields.map((f) => f.name).slice(0, 6) : ['id']);
                        return {
                            ...r,
                            ...schema,
                            fields,
                            listDisplay,
                            searchFields: schema.searchFields || [],
                            listFilter: (schema.filters || schema.listFilter || []).map((fl) => typeof fl === 'string' ? fl : fl.field || fl.name),
                            actions: schema.actions || [],
                            bulkActions: schema.bulkActions || [],
                            inlines: schema.inlines || [],
                        };
                    }
                    catch {
                        return {
                            ...r,
                            fields: r.fields || [],
                            listDisplay: r.listDisplay || ['id'],
                        };
                    }
                }));
                setResources(fullResources);
            }
        }
        catch (err) {
            console.error('Failed to load admin resources:', err);
        }
    }, [fetchApi]);
    useEffect(() => {
        refreshResources();
    }, [refreshResources]);
    // Determine active resource from route (e.g. #changelist/products -> products)
    const activeResourceId = route.startsWith('#changelist/')
        ? route.replace('#changelist/', '')
        : route.startsWith('#changeform/')
            ? route.replace('#changeform/', '').split('/')[0]
            : null;
    const activeResource = resources.find((r) => r.id === activeResourceId) || null;
    return (_jsx(AdminContext.Provider, { value: {
            config: mergedConfig,
            theme,
            setTheme,
            toggleTheme,
            isAuthenticated,
            authToken,
            login,
            logout,
            user,
            setUser,
            resources,
            activeResource,
            route,
            setRoute,
            toasts,
            showToast,
            removeToast,
            isMobileSidebarOpen,
            setMobileSidebarOpen,
            breadcrumbs,
            setBreadcrumbs,
            fetchApi,
            refreshResources,
        }, children: children }));
};
//# sourceMappingURL=AdminContext.js.map