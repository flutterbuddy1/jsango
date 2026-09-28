import type { Identity, AuthorizationManager } from '@jsango/auth';
import type { AdminResource } from '@jsango/admin-core';
export interface AdminAuthOptions {
    readonly authorizationManager?: AuthorizationManager | undefined;
    readonly requireSuperuser?: boolean | undefined;
    readonly staffRole?: string | undefined;
    readonly adminPermission?: string | undefined;
}
/**
 * Evaluates model, object, field, and action permissions for the Admin platform.
 * Fails closed: unauthenticated or unauthorized identities are denied by default.
 */
export declare class AdminPermissionChecker {
    private readonly authz?;
    private readonly requireSuperuser;
    private readonly staffRole;
    private readonly adminPermission;
    constructor(options?: AdminAuthOptions);
    /**
     * Checks if an identity is allowed to access the admin platform at all.
     */
    canAccessAdmin(identity?: Identity): boolean;
    /**
     * Checks if an identity can view list and details of a resource.
     */
    canViewResource(identity: Identity | undefined, resource: AdminResource): Promise<boolean>;
    /**
     * Checks if an identity can create new records in a resource.
     */
    canCreate(identity: Identity | undefined, resource: AdminResource): Promise<boolean>;
    /**
     * Checks if an identity can update a record (with optional object-level check).
     */
    canUpdate(identity: Identity | undefined, resource: AdminResource, item?: Record<string, unknown>): Promise<boolean>;
    /**
     * Checks if an identity can delete a record.
     */
    canDelete(identity: Identity | undefined, resource: AdminResource, item?: Record<string, unknown>): Promise<boolean>;
    /**
     * Checks if an identity can restore a soft-deleted record.
     */
    canRestore(identity: Identity | undefined, resource: AdminResource, item?: Record<string, unknown>): Promise<boolean>;
    /**
     * Checks if an identity can execute a custom row action.
     */
    canExecuteAction(identity: Identity | undefined, resource: AdminResource, actionId: string, item?: Record<string, unknown>): Promise<boolean>;
    /**
     * Checks if an identity can execute a bulk action.
     */
    canExecuteBulkAction(identity: Identity | undefined, resource: AdminResource, actionId: string): Promise<boolean>;
    /**
     * Checks field-level read visibility.
     */
    canViewField(identity: Identity | undefined, resource: AdminResource, fieldName: string): boolean;
    /**
     * Checks field-level write permission.
     */
    canEditField(identity: Identity | undefined, resource: AdminResource, fieldName: string): boolean;
    /**
     * Checks export permission.
     */
    canExport(identity: Identity | undefined, resource: AdminResource): boolean;
    /**
     * Checks import permission.
     */
    canImport(identity: Identity | undefined, resource: AdminResource): boolean;
}
//# sourceMappingURL=checker.d.ts.map