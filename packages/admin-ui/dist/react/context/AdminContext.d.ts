import React from 'react';
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
    choices?: Array<{
        value: any;
        label: string;
    }>;
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
    login: (email: string, password: string, totpCode?: string) => Promise<{
        ok: boolean;
        requires2fa?: boolean;
        token?: string;
        user?: AdminUser;
    }>;
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
export declare function useAdmin(): AdminContextValue;
export interface AdminProviderProps {
    config?: Partial<AdminConfig>;
    initialUser?: Partial<AdminUser>;
    children: React.ReactNode;
}
export declare const AdminProvider: React.FC<AdminProviderProps>;
export {};
//# sourceMappingURL=AdminContext.d.ts.map