import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperuser: boolean;
  avatarUrl?: string | undefined;
  lastLoginAt?: string | undefined;
}

export interface AdminResourceField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'json' | 'relation' | 'textarea' | 'file' | 'image';
  required?: boolean;
  readOnly?: boolean;
  choices?: Array<{ value: any; label: string }>;
  helpText?: string;
  relatedResource?: string;
}

export interface AdminCustomAction {
  id: string;
  label: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  style?: 'default' | 'danger' | 'primary';
}

export interface AdminBulkAction {
  id: string;
  label: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface AdminInlineRelation {
  name: string;
  label: string;
  fields: AdminResourceField[];
  defaultRows?: number;
}

export interface AdminResource {
  id: string;
  label: string;
  pluralLabel: string;
  navigationGroup?: string;
  navigationIcon?: string;
  listDisplay?: string[];
  searchFields?: string[];
  listFilter?: string[];
  listPerPage?: number;
  fields: AdminResourceField[];
  actions?: AdminCustomAction[];
  bulkActions?: AdminBulkAction[];
  inlines?: AdminInlineRelation[];
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface AdminConfig {
  title: string;
  brandSubtitle: string;
  siteUrl: string;
  apiBasePath: string;
  defaultTheme: 'light' | 'dark' | 'system';
  enableCommandPalette?: boolean;
  enableTwoFactor?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminContextValue {
  config: AdminConfig;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  isAuthenticated: boolean;
  authToken: string | null;
  login: (
    email: string,
    password: string,
    totpCode?: string
  ) => Promise<{ ok: boolean; requires2fa?: boolean; token?: string; user?: AdminUser }>;
  logout: () => Promise<void>;
  user: AdminUser;
  setUser: React.Dispatch<React.SetStateAction<AdminUser>>;
  resources: AdminResource[];
  activeResource: AdminResource | null;
  route: string;
  setRoute: (r: string) => void;
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (b: BreadcrumbItem[]) => void;
  fetchApi: <T = any>(endpoint: string, init?: RequestInit) => Promise<T>;
  refreshResources: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return ctx;
}

export interface AdminProviderProps {
  config?: Partial<AdminConfig>;
  initialUser?: Partial<AdminUser>;
  children: React.ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({
  config: userConfig,
  initialUser,
  children,
}) => {
  const mergedConfig: AdminConfig = {
    title: userConfig?.title || 'JSango Administration',
    brandSubtitle: userConfig?.brandSubtitle || 'Enterprise Admin Control',
    siteUrl: userConfig?.siteUrl || '/',
    apiBasePath: (userConfig?.apiBasePath || (userConfig as any)?.apiPrefix || '/api/admin').replace(/\/$/, ''),
    defaultTheme: userConfig?.defaultTheme || 'dark',
    enableCommandPalette: userConfig?.enableCommandPalette ?? true,
    enableTwoFactor: userConfig?.enableTwoFactor ?? true,
  };

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('jsango_admin_theme') : null;
    if (saved === 'light' || saved === 'dark') return saved;
    return mergedConfig.defaultTheme === 'light' ? 'light' : 'dark';
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('jsango_admin_token');
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [user, setUser] = useState<AdminUser>({
    id: initialUser?.id || 'usr-admin-01',
    name: initialUser?.name || 'System Administrator',
    email: initialUser?.email || 'admin@jsango.dev',
    role: initialUser?.role || 'Superuser',
    isSuperuser: initialUser?.isSuperuser ?? true,
    avatarUrl: initialUser?.avatarUrl,
    lastLoginAt: initialUser?.lastLoginAt || new Date().toISOString(),
  });

  const [resources, setResources] = useState<AdminResource[]>([]);
  const [route, setRouteState] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return window.location.hash;
    }
    return '#dashboard';
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'Dashboard', href: '#dashboard' },
  ]);

  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
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

  const setRoute = useCallback((newRoute: string) => {
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

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
      const id = 'toast_' + Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchApi = useCallback(
    async <T = any,>(endpoint: string, init?: RequestInit): Promise<T> => {
      const url = `${mergedConfig.apiBasePath}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...((init?.headers as Record<string, string>) || {}),
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
        return {} as T;
      }

      const text = await res.text();
      let body: any = null;
      if (text && text.trim().length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
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

      return (body ?? {}) as T;
    },
    [mergedConfig.apiBasePath, authToken]
  );

  const login = useCallback(
    async (email: string, password: string, totpCode?: string) => {
      const res = await fetchApi<any>('/auth/login', {
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
    },
    [fetchApi]
  );

  const logout = useCallback(async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
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
        const res = await fetchApi<any>('/auth/me');
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
      } catch {
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
      const res = await fetchApi<any>('/resources');
      const rawResources = res?.data?.resources || res?.resources || [];
      if (Array.isArray(rawResources)) {
        const fullResources: AdminResource[] = await Promise.all(
          rawResources.map(async (r: any) => {
            try {
              const schemaRes = await fetchApi<any>(`/resources/${r.id}/schema`);
              const schema = schemaRes?.data?.schema || schemaRes?.schema || {};
              const fields: AdminResourceField[] = (schema.fields || []).map((f: any) => ({
                name: f.name,
                label: f.label || f.name,
                type:
                  f.type === 'datetime'
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
              const listDisplay: string[] =
                schema.listFields ||
                schema.listDisplay ||
                (fields.length > 0 ? fields.map((f) => f.name).slice(0, 6) : ['id']);
              return {
                ...r,
                ...schema,
                fields,
                listDisplay,
                searchFields: schema.searchFields || [],
                listFilter: (schema.filters || schema.listFilter || []).map((fl: any) =>
                  typeof fl === 'string' ? fl : fl.field || fl.name
                ),
                actions: schema.actions || [],
                bulkActions: schema.bulkActions || [],
                inlines: schema.inlines || [],
              };
            } catch {
              return {
                ...r,
                fields: r.fields || [],
                listDisplay: r.listDisplay || ['id'],
              };
            }
          })
        );
        setResources(fullResources);
      }
    } catch (err) {
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

  return (
    <AdminContext.Provider
      value={{
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
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};
