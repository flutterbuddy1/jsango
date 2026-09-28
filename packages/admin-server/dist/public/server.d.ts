import type { IRouter } from '@jsango/router';
import type { HttpRequest } from '@jsango/http';
import { type Identity } from '@jsango/auth';
import type { AdminRegistry } from '@jsango/admin-core';
import type { AdminPermissionChecker } from '@jsango/admin-auth';
import type { AdminAuditLogger } from '@jsango/admin-audit';
import type { IAdminQueryAdapter } from './types.js';
export interface AdminCredentialsOptions {
    /**
     * Super admin username for login.
     * @default 'admin' or process.env.JSANGO_ADMIN_USER
     */
    readonly username?: string | undefined;
    /**
     * Super admin email address.
     * @default 'admin@jsango.dev' or process.env.JSANGO_ADMIN_EMAIL
     */
    readonly email?: string | undefined;
    /**
     * Super admin password.
     * @default 'admin123' or process.env.JSANGO_ADMIN_PASSWORD
     */
    readonly password?: string | undefined;
    /**
     * Super admin display name.
     * @default 'System Administrator'
     */
    readonly name?: string | undefined;
}
export interface AdminServerOptions {
    /**
     * Admin registry containing all registered resources and pages.
     */
    readonly registry: AdminRegistry;
    /**
     * ORM query adapter used by the CRUD service layer.
     */
    readonly queryAdapter: IAdminQueryAdapter;
    /**
     * Permission checker used to enforce access control.
     */
    readonly permissions: AdminPermissionChecker;
    /**
     * Audit logger for recording all admin mutations.
     */
    readonly audit: AdminAuditLogger;
    /**
     * URL prefix for all admin routes.
     * Default: '/admin/api/v1'.
     */
    readonly prefix?: string | undefined;
    /**
     * Custom credentials for the super admin account.
     */
    readonly credentials?: AdminCredentialsOptions | undefined;
    /**
     * Alias for credentials.
     */
    readonly auth?: AdminCredentialsOptions | undefined;
    /**
     * Callback to extract the actor's Identity from a request.
     * Inject from the auth middleware or session.
     */
    readonly resolveIdentity?: ((req: HttpRequest) => Promise<Identity | undefined> | Identity | undefined) | undefined;
}
/**
 * Registers all Admin HTTP API routes onto the provided router instance.
 *
 * Route structure (relative to prefix):
 *
 *   GET    /resources                          — list registered resources
 *   GET    /resources/:resourceId/schema       — resource schema
 *   GET    /resources/:resourceId              — list items
 *   POST   /resources/:resourceId              — create item
 *   GET    /resources/:resourceId/:id          — retrieve item
 *   PATCH  /resources/:resourceId/:id          — update item
 *   DELETE /resources/:resourceId/:id          — delete item
 *   POST   /resources/:resourceId/:id/restore  — restore soft-deleted item
 *   POST   /resources/:resourceId/:id/actions/:actionId   — row action
 *   POST   /resources/:resourceId/bulk/:actionId          — bulk action
 *   GET    /audit                              — query audit log
 */
export declare class AdminServer {
    private readonly registry;
    private readonly crud;
    private readonly permissions;
    private readonly audit;
    private readonly prefix;
    private readonly resolveIdentity;
    private readonly totp;
    private adminEmail;
    private adminUsername;
    private adminPassword;
    private adminName;
    private readonly activeTokens;
    private readonly twoFactorStore;
    private readonly pending2faSecrets;
    private readonly sessionsStore;
    constructor(options: AdminServerOptions);
    /**
     * Mounts all Admin routes onto the given router.
     * Call this during application bootstrap after the registry is populated.
     */
    mount(router: IRouter): void;
    private handleListResources;
    private handleGetSchema;
    private handleList;
    private handleCreate;
    private handleDetail;
    private handleUpdate;
    private handleDelete;
    private handleRestore;
    private handleAction;
    private handleBulkAction;
    private handleAuditQuery;
    private handleLogin;
    private handleLogout;
    private handleGetAuthMe;
    private handleGetProfile;
    private handleUpdatePassword;
    private handleSetup2fa;
    private handleVerify2fa;
    private handleDisable2fa;
    private handleListSessions;
    private handleDeleteSession;
    private handleTerminateOtherSessions;
    private handleGetDashboard;
    private handleListPages;
    private handleGetPage;
    private handleGetHealth;
    private handleError;
}
//# sourceMappingURL=server.d.ts.map