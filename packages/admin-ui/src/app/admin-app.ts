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
import { renderAdminShell } from '../components/layout/admin-shell.js';
import { renderDashboardView } from '../components/views/dashboard-view.js';
import { renderResourceListView } from '../components/views/resource-list-view.js';
import { renderResourceDetailView } from '../components/views/resource-detail-view.js';
import { renderResourceCreateView } from '../components/views/resource-create-view.js';
import { renderResourceEditView } from '../components/views/resource-edit-view.js';
import { renderAuditLogView } from '../components/views/audit-log-view.js';
import { renderSystemHealthView } from '../components/views/system-health-view.js';
import { renderLoginView } from '../components/views/login-view.js';
import {
  buildDefaultCommands,
  renderCommandPalette,
} from '../components/modals/command-palette.js';

export interface AdminAppOptions {
  readonly config?: AdminUiConfig | undefined;
  readonly client?: AdminApiClient | undefined;
  readonly queryClient?: QueryClient | undefined;
  readonly plugins?: readonly AdminUiPlugin[] | undefined;
}

export class AdminApp {
  public readonly config: AdminUiConfig;
  public readonly client: AdminApiClient;
  public readonly queryClient: QueryClient;
  public readonly theme: ThemeManager;
  public readonly auth: AdminAuthManager;
  public readonly toasts: ToastManager;
  public readonly plugins: AdminUiPluginRegistry;

  private currentRoute: AdminRoute = { name: 'dashboard' };
  private isSidebarCollapsed = false;
  private isCommandPaletteOpen = false;
  private commandPaletteQuery = '';

  constructor(options: AdminAppOptions = {}) {
    this.config = options.config ?? {};
    this.client = options.client ?? new AdminApiClient({ baseUrl: this.config.apiBaseUrl });
    this.queryClient = options.queryClient ?? new QueryClient();
    this.theme = new ThemeManager(this.config.defaultTheme ?? 'system');
    this.auth = new AdminAuthManager();
    this.toasts = new ToastManager();
    this.plugins = new AdminUiPluginRegistry();

    if (options.plugins) {
      for (const p of options.plugins) {
        this.plugins.registerPlugin(p);
      }
    }
  }

  // ------------------------------------------------------------------
  // State getters & setters
  // ------------------------------------------------------------------

  public getRoute(): AdminRoute {
    return this.currentRoute;
  }

  public setRoute(route: AdminRoute): void {
    this.currentRoute = route;
  }

  public toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  public openCommandPalette(): void {
    this.isCommandPaletteOpen = true;
  }

  public closeCommandPalette(): void {
    this.isCommandPaletteOpen = false;
    this.commandPaletteQuery = '';
  }

  public setCommandPaletteQuery(q: string): void {
    this.commandPaletteQuery = q;
  }

  // ------------------------------------------------------------------
  // Data Loading & Caching Helpers
  // ------------------------------------------------------------------

  public async loadResources(): Promise<readonly AdminResourceSummary[]> {
    return this.queryClient.fetchQuery({
      queryKey: ['admin', 'resources'],
      queryFn: () => this.client.listResources(),
      staleTimeMs: 60_000,
    });
  }

  public async loadResourceSchema(resourceId: string): Promise<AdminResourceSchema> {
    return this.queryClient.fetchQuery({
      queryKey: ['admin', 'schema', resourceId],
      queryFn: () => this.client.getResourceSchema(resourceId),
      staleTimeMs: 60_000,
    });
  }

  // ------------------------------------------------------------------
  // Full Page Render Engine
  // ------------------------------------------------------------------

  public async render(): Promise<string> {
    const authState = this.auth.getState();
    const appTitle = this.config.title ?? 'JSango Admin';

    // If not authenticated and on login route
    if (this.currentRoute.name === 'login') {
      return renderLoginView({ appTitle });
    }

    const resources = await this.loadResources().catch(() => []);
    const customPages = await this.client.listPages().catch(() => []);

    let contentHtml = '';
    let activePath = '/admin';

    try {
      switch (this.currentRoute.name) {
        case 'dashboard': {
          activePath = '/admin';
          const dashboardData = await this.client
            .getDashboard()
            .catch(() => ({ widgets: [], data: {} }));
          contentHtml = renderDashboardView({
            widgets: dashboardData.widgets,
            data: dashboardData.data,
          });
          break;
        }

        case 'resource-list': {
          activePath = `/admin/resources/${this.currentRoute.resourceId}`;
          const schema = await this.loadResourceSchema(this.currentRoute.resourceId);
          const listRes = await this.client.listRecords(this.currentRoute.resourceId).catch(() => ({
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
            totalPages: 0,
          }));

          contentHtml = renderResourceListView({
            schema,
            items: listRes.items,
            total: listRes.total,
            page: listRes.page,
            pageSize: listRes.pageSize,
            totalPages: listRes.totalPages,
            activeFilters: {},
          });
          break;
        }

        case 'resource-create': {
          activePath = `/admin/resources/${this.currentRoute.resourceId}`;
          const schema = await this.loadResourceSchema(this.currentRoute.resourceId);
          contentHtml = renderResourceCreateView({ schema });
          break;
        }

        case 'resource-detail': {
          activePath = `/admin/resources/${this.currentRoute.resourceId}`;
          const schema = await this.loadResourceSchema(this.currentRoute.resourceId);
          const item = await this.client.getRecord(
            this.currentRoute.resourceId,
            this.currentRoute.recordId
          );
          contentHtml = renderResourceDetailView({ schema, item });
          break;
        }

        case 'resource-edit': {
          activePath = `/admin/resources/${this.currentRoute.resourceId}`;
          const schema = await this.loadResourceSchema(this.currentRoute.resourceId);
          const item = await this.client.getRecord(
            this.currentRoute.resourceId,
            this.currentRoute.recordId
          );
          contentHtml = renderResourceEditView({ schema, item });
          break;
        }

        case 'audit-log': {
          activePath = '/admin/audit';
          const auditRes = await this.client
            .getAuditLogs()
            .catch(() => ({ entries: [], total: 0 }));
          contentHtml = renderAuditLogView({
            entries: auditRes.entries,
            total: auditRes.total,
          });
          break;
        }

        case 'system-health': {
          activePath = '/admin/system/health';
          const health = await this.client.getSystemHealth().catch(() => ({
            status: 'healthy' as const,
            timestamp: new Date().toISOString(),
            uptime: 0,
          }));
          contentHtml = renderSystemHealthView({ health });
          break;
        }

        default: {
          contentHtml = '<div class="p-8 text-center text-muted-foreground">Page not found</div>';
        }
      }
    } catch (err: unknown) {
      contentHtml = `
        <div class="p-6 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs">
          <div class="font-bold text-sm mb-1">Failed to render page</div>
          <div>${err instanceof Error ? err.message : String(err)}</div>
        </div>
      `;
    }

    // Command palette modal
    let modalHtml = '';
    if (this.isCommandPaletteOpen) {
      const commands = buildDefaultCommands({
        resources,
        onNavigate: (route) => {
          this.closeCommandPalette();
          if (route.startsWith('/admin/resources/')) {
            const resId = route.replace('/admin/resources/', '');
            this.setRoute({ name: 'resource-list', resourceId: resId });
          } else if (route === '/admin/audit') {
            this.setRoute({ name: 'audit-log' });
          } else if (route === '/admin/system/health') {
            this.setRoute({ name: 'system-health' });
          } else {
            this.setRoute({ name: 'dashboard' });
          }
        },
        onSetTheme: (theme) => {
          this.theme.setMode(theme);
          this.closeCommandPalette();
        },
      });

      modalHtml = renderCommandPalette(commands, this.commandPaletteQuery);
    }

    return renderAdminShell({
      resources,
      customPages,
      activePath,
      user: authState.user,
      themeMode: this.theme.getMode(),
      isSidebarCollapsed: this.isSidebarCollapsed,
      contentHtml,
      toasts: this.toasts.getToasts(),
      modalHtml,
      appTitle,
    });
  }
}
