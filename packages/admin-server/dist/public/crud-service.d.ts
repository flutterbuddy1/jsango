import type { Identity } from '@jsango/auth';
import type { AdminResource, AdminResourceSchema } from '@jsango/admin-core';
import type { AdminPermissionChecker } from '@jsango/admin-auth';
import type { AdminAuditLogger } from '@jsango/admin-audit';
import type { IAdminQueryAdapter, AdminListQuery, AdminListResult, AdminRequestContext } from './types.js';
export interface AdminCrudServiceOptions {
    readonly queryAdapter: IAdminQueryAdapter;
    readonly permissions: AdminPermissionChecker;
    readonly audit: AdminAuditLogger;
}
/**
 * Orchestrates CRUD operations for a single Admin resource.
 * All operations enforce permission checks and emit audit events before returning.
 */
export declare class AdminCrudService {
    private readonly adapter;
    private readonly permissions;
    private readonly audit;
    constructor(options: AdminCrudServiceOptions);
    /**
     * Returns the resource schema visible to the given identity.
     * Sensitive fields are stripped for non-superusers.
     */
    getSchema(resource: AdminResource, identity: Identity | undefined): AdminResourceSchema;
    list(resource: AdminResource, query: AdminListQuery, identity: Identity | undefined, _context?: AdminRequestContext | undefined): Promise<AdminListResult>;
    detail(resource: AdminResource, id: string | number, identity: Identity | undefined): Promise<Record<string, unknown>>;
    create(resource: AdminResource, rawData: Record<string, unknown>, identity: Identity | undefined, context?: AdminRequestContext | undefined): Promise<Record<string, unknown>>;
    update(resource: AdminResource, id: string | number, rawData: Record<string, unknown>, identity: Identity | undefined, context?: AdminRequestContext | undefined): Promise<Record<string, unknown>>;
    delete(resource: AdminResource, id: string | number, identity: Identity | undefined, context?: AdminRequestContext | undefined): Promise<void>;
    restore(resource: AdminResource, id: string | number, identity: Identity | undefined, context?: AdminRequestContext | undefined): Promise<Record<string, unknown>>;
    executeAction(resource: AdminResource, actionId: string, id: string | number, input: unknown, identity: Identity | undefined, context?: AdminRequestContext | undefined): Promise<unknown>;
    executeBulkAction(resource: AdminResource, actionId: string, ids: readonly (string | number)[], input: unknown, identity: Identity | undefined, context?: AdminRequestContext | undefined): Promise<unknown>;
    /** Strips fields the actor cannot read for a given view context. */
    private filterFields;
    /**
     * Restricts incoming data to the allowed field set and strips any fields
     * the actor cannot edit.
     */
    private pickAllowedFields;
    private represent;
    private actorSnapshot;
}
//# sourceMappingURL=crud-service.d.ts.map