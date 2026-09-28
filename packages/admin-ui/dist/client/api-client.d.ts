import type { AdminResourceSchema } from '@jsango/admin-core';
import type { AdminResourceSummary, AdminListQueryState, AdminListResponse, AdminUserIdentity, AdminAuditRecord, AdminSystemHealth } from '../types/index.js';
import type { AdminApiClientOptions, DashboardResponse, CustomPageSummary } from './types.js';
export declare class AdminApiClient {
    private readonly baseUrl;
    private readonly getAuthToken?;
    private readonly onUnauthorized?;
    private readonly fetchFn;
    constructor(options?: AdminApiClientOptions);
    private request;
    getAuthMe(): Promise<{
        user: AdminUserIdentity;
        canAccessAdmin: boolean;
    }>;
    listResources(): Promise<readonly AdminResourceSummary[]>;
    getResourceSchema(resourceId: string): Promise<AdminResourceSchema>;
    listRecords<T = Record<string, unknown>>(resourceId: string, query?: Partial<AdminListQueryState>): Promise<AdminListResponse<T>>;
    getRecord<T = Record<string, unknown>>(resourceId: string, id: string | number): Promise<T>;
    createRecord<T = Record<string, unknown>>(resourceId: string, data: Record<string, unknown>): Promise<T>;
    updateRecord<T = Record<string, unknown>>(resourceId: string, id: string | number, data: Record<string, unknown>): Promise<T>;
    deleteRecord(resourceId: string, id: string | number): Promise<void>;
    restoreRecord<T = Record<string, unknown>>(resourceId: string, id: string | number): Promise<T>;
    executeAction<TResult = unknown>(resourceId: string, id: string | number, actionId: string, input?: unknown): Promise<TResult>;
    executeBulkAction<TResult = unknown>(resourceId: string, actionId: string, ids: readonly (string | number)[], input?: unknown): Promise<TResult>;
    getDashboard(): Promise<DashboardResponse>;
    listPages(): Promise<readonly CustomPageSummary[]>;
    getPage(pageId: string): Promise<CustomPageSummary>;
    getAuditLogs(options?: {
        readonly resourceId?: string | undefined;
        readonly action?: string | undefined;
        readonly actorId?: string | undefined;
        readonly limit?: number | undefined;
        readonly offset?: number | undefined;
    }): Promise<{
        entries: readonly AdminAuditRecord[];
        total: number;
    }>;
    getSystemHealth(): Promise<AdminSystemHealth>;
}
//# sourceMappingURL=api-client.d.ts.map