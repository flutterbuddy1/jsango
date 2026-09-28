/**
 * Main Application Orchestrator for @jsango/admin-ui
 */
import type { AdminResourceSchema } from '@jsango/admin-core';
import type { AdminUiConfig, AdminResourceSummary, AdminRoute } from '../types/index.js';
import { AdminApiClient } from '../client/api-client.js';
import { QueryClient } from '../query/query-client.js';
import { ThemeManager } from '../theme/theme-context.js';
import { AdminAuthManager } from '../auth/auth-context.js';
import { ToastManager } from '../notifications/toast-context.js';
import { AdminUiPluginRegistry, type AdminUiPlugin } from '../plugins/index.js';
export interface AdminAppOptions {
    readonly config?: AdminUiConfig | undefined;
    readonly client?: AdminApiClient | undefined;
    readonly queryClient?: QueryClient | undefined;
    readonly plugins?: readonly AdminUiPlugin[] | undefined;
}
export declare class AdminApp {
    readonly config: AdminUiConfig;
    readonly client: AdminApiClient;
    readonly queryClient: QueryClient;
    readonly theme: ThemeManager;
    readonly auth: AdminAuthManager;
    readonly toasts: ToastManager;
    readonly plugins: AdminUiPluginRegistry;
    private currentRoute;
    private isSidebarCollapsed;
    private isCommandPaletteOpen;
    private commandPaletteQuery;
    constructor(options?: AdminAppOptions);
    getRoute(): AdminRoute;
    setRoute(route: AdminRoute): void;
    toggleSidebar(): void;
    openCommandPalette(): void;
    closeCommandPalette(): void;
    setCommandPaletteQuery(q: string): void;
    loadResources(): Promise<readonly AdminResourceSummary[]>;
    loadResourceSchema(resourceId: string): Promise<AdminResourceSchema>;
    render(): Promise<string>;
}
//# sourceMappingURL=admin-app.d.ts.map