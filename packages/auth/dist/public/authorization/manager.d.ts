import type { Identity, AuthContext, AuthorizationDecision, IPolicy } from '../types.js';
import { PermissionRegistry } from './permission.js';
import { RoleRegistry } from './role.js';
import { PolicyRegistry } from './policy.js';
export interface AuthorizationManagerOptions {
    readonly permissions?: PermissionRegistry | undefined;
    readonly roles?: RoleRegistry | undefined;
    readonly policies?: PolicyRegistry | undefined;
}
export interface AuthorizeOptions {
    readonly throwOnDeny?: boolean | undefined;
    readonly context?: AuthContext | undefined;
    readonly policy?: string | IPolicy | undefined;
}
export declare class AuthorizationManager {
    readonly permissions: PermissionRegistry;
    readonly roles: RoleRegistry;
    readonly policies: PolicyRegistry;
    constructor(options?: AuthorizationManagerOptions);
    /**
     * Evaluates whether an identity can perform an action on an optional resource.
     * Centralizes superuser check, policy resolution, role-to-permission mapping, and fail-closed security.
     */
    authorize(identity: Identity | undefined, action: string, resource?: unknown, options?: AuthorizeOptions): Promise<AuthorizationDecision>;
    /**
     * Helper that returns a boolean indicating whether the action is allowed.
     */
    can(identity: Identity | undefined, action: string, resource?: unknown, context?: AuthContext): Promise<boolean>;
    /**
     * Enforces that the action is allowed. Throws ForbiddenError if denied.
     */
    enforce(identity: Identity | undefined, action: string, resource?: unknown, context?: AuthContext): Promise<AuthorizationDecision>;
    /**
     * Evaluates authorization for multiple resources in bulk (useful for Admin bulk actions).
     */
    authorizeMany<T = unknown>(identity: Identity | undefined, action: string, resources: readonly T[], options?: AuthorizeOptions): Promise<readonly AuthorizationDecision[]>;
    private normalizeResult;
}
//# sourceMappingURL=manager.d.ts.map