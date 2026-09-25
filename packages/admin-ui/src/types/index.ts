/**
 * Public types for @jsango/admin-ui
 */
import type { AdminSortDirection } from '@jsango/admin-core';

export interface AdminUiConfig {
  readonly title?: string | undefined;
  readonly logoUrl?: string | undefined;
  readonly apiBaseUrl?: string | undefined;
  readonly defaultTheme?: 'light' | 'dark' | 'system' | undefined;
  readonly enableCommandPalette?: boolean | undefined;
  readonly enableAuditLog?: boolean | undefined;
  readonly enableMediaManager?: boolean | undefined;
  readonly enableSystemHealth?: boolean | undefined;
  readonly itemsPerPage?: number | undefined;
}

export interface AdminResourceSummary {
  readonly id: string;
  readonly label: string;
  readonly pluralLabel: string;
  readonly navigationGroup?: string | undefined;
  readonly navigationIcon?: string | undefined;
  readonly navigationOrder?: number | undefined;
}

export interface AdminUserIdentity {
  readonly id: string;
  readonly username: string;
  readonly email?: string | undefined;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly isSuperuser: boolean;
  readonly avatarUrl?: string | undefined;
}

export interface AdminListQueryState {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string | undefined;
  readonly sort?: string | undefined;
  readonly sortDirection?: AdminSortDirection | undefined;
  readonly filters: Record<string, unknown>;
}

export interface AdminListResponse<T = Record<string, unknown>> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface AdminAuditRecord {
  readonly id: string;
  readonly resourceId: string;
  readonly recordId: string | number;
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'action' | 'bulk_action';
  readonly actorId?: string | undefined;
  readonly actorName?: string | undefined;
  readonly ipAddress?: string | undefined;
  readonly timestamp: string | number;
  readonly changes?:
    | {
        readonly before?: Record<string, unknown> | undefined;
        readonly after?: Record<string, unknown> | undefined;
      }
    | undefined;
}

export interface AdminSystemHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: string;
  readonly uptime: number;
  readonly memory?:
    | {
        readonly heapUsed?: number | undefined;
        readonly heapTotal?: number | undefined;
        readonly rss?: number | undefined;
      }
    | undefined;
  readonly nodeVersion?: string | undefined;
  readonly services?:
    | Record<
        string,
        { readonly status: 'up' | 'down' | 'degraded'; readonly message?: string | undefined }
      >
    | undefined;
}

export interface AdminMediaItem {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly url: string;
  readonly uploadedAt: string | number;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

export interface ToastMessage {
  readonly id: string;
  readonly type: 'success' | 'error' | 'warning' | 'info';
  readonly title: string;
  readonly message?: string | undefined;
  readonly durationMs?: number | undefined;
}

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string | undefined;
  readonly active?: boolean | undefined;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type AdminRoute =
  | { readonly name: 'dashboard' }
  | { readonly name: 'resource-list'; readonly resourceId: string }
  | { readonly name: 'resource-create'; readonly resourceId: string }
  | {
      readonly name: 'resource-detail';
      readonly resourceId: string;
      readonly recordId: string | number;
    }
  | {
      readonly name: 'resource-edit';
      readonly resourceId: string;
      readonly recordId: string | number;
    }
  | { readonly name: 'audit-log' }
  | { readonly name: 'media-manager' }
  | { readonly name: 'system-health' }
  | { readonly name: 'jobs-monitor' }
  | { readonly name: 'custom-page'; readonly pageId: string }
  | { readonly name: 'login' };
