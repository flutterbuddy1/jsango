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
export class AdminPermissionChecker {
  private readonly authz?: AuthorizationManager | undefined;
  private readonly requireSuperuser: boolean;
  private readonly staffRole: string;
  private readonly adminPermission: string;

  constructor(options: AdminAuthOptions = {}) {
    this.authz = options.authorizationManager;
    this.requireSuperuser = options.requireSuperuser ?? false;
    this.staffRole = options.staffRole ?? 'admin';
    this.adminPermission = options.adminPermission ?? 'admin.access';
  }

  /**
   * Checks if an identity is allowed to access the admin platform at all.
   */
  public canAccessAdmin(identity?: Identity): boolean {
    if (!identity || !identity.isAuthenticated) {
      return false;
    }

    if (identity.isSuperuser) {
      return true;
    }

    if (this.requireSuperuser) {
      return false;
    }

    if (
      identity.hasRole(this.staffRole) ||
      identity.hasRole('staff') ||
      identity.hasRole('superuser')
    ) {
      return true;
    }

    if (identity.hasPermission(this.adminPermission) || identity.hasPermission('*')) {
      return true;
    }

    return false;
  }

  /**
   * Superusers and the `staffRole` role (default `admin`) can do everything. Everyone else let in
   * through the `staff` role or the `admin.access` permission needs explicit permissions
   * (`admin.<resource>.<action>`, `admin.<resource>.*`, `admin.*`) or an authorization policy.
   */
  public hasFullAccess(identity: Identity | undefined): boolean {
    return Boolean(
      identity &&
      this.canAccessAdmin(identity) &&
      (identity.isSuperuser || identity.hasRole(this.staffRole) || identity.hasRole('superuser'))
    );
  }

  /**
   * One rule for every action. Default deny: without a matching permission or policy, limited
   * staff can do nothing (before, they could do everything, e.g. make themselves superuser).
   */
  private async allowed(
    identity: Identity | undefined,
    resource: AdminResource,
    action: string,
    target?: Record<string, unknown>,
    policyAction = action
  ): Promise<boolean> {
    if (!identity || !this.canAccessAdmin(identity)) return false;
    if (this.hasFullAccess(identity)) return true;
    const granted =
      identity.hasPermission(`admin.${resource.id}.${action}`) ||
      identity.hasPermission(`admin.${resource.id}.*`) ||
      identity.hasPermission('admin.*');
    if (granted && (!target || !this.authz)) return true;
    // Object-level policies still apply on top of a granted permission.
    if (this.authz) return this.authz.can(identity, policyAction, target ?? resource.modelName);
    return false;
  }

  /** Checks if an identity can view list and details of a resource. */
  public canViewResource(identity: Identity | undefined, resource: AdminResource) {
    return this.allowed(identity, resource, 'view');
  }

  /** Checks if an identity can create new records in a resource. */
  public canCreate(identity: Identity | undefined, resource: AdminResource) {
    return this.allowed(identity, resource, 'add');
  }

  /** Checks if an identity can update a record (with optional object-level check). */
  public canUpdate(
    identity: Identity | undefined,
    resource: AdminResource,
    item?: Record<string, unknown>
  ) {
    return this.allowed(identity, resource, 'change', item);
  }

  /** Checks if an identity can delete a record. */
  public canDelete(
    identity: Identity | undefined,
    resource: AdminResource,
    item?: Record<string, unknown>
  ) {
    return this.allowed(identity, resource, 'delete', item);
  }

  /** Checks if an identity can restore a soft-deleted record. */
  public canRestore(
    identity: Identity | undefined,
    resource: AdminResource,
    item?: Record<string, unknown>
  ) {
    return this.allowed(identity, resource, 'restore', item);
  }

  /** Checks if an identity can execute a custom row action (`admin.<resource>.action.<id>`). */
  public async canExecuteAction(
    identity: Identity | undefined,
    resource: AdminResource,
    actionId: string,
    item?: Record<string, unknown>
  ): Promise<boolean> {
    const action = resource.actions.get(actionId);
    if (!action) return false;
    if (action.permission && !this.hasFullAccess(identity)) {
      if (!identity?.hasPermission(action.permission) && !identity?.hasPermission('admin.*'))
        return false;
    }
    return this.allowed(identity, resource, `action.${actionId}`, item, actionId);
  }

  /** Checks if an identity can execute a bulk action (`admin.<resource>.bulk.<id>`). */
  public async canExecuteBulkAction(
    identity: Identity | undefined,
    resource: AdminResource,
    actionId: string
  ): Promise<boolean> {
    const bulkAction = resource.bulkActions.get(actionId);
    if (!bulkAction) return false;
    if (bulkAction.permission && !this.hasFullAccess(identity)) {
      if (!identity?.hasPermission(bulkAction.permission) && !identity?.hasPermission('admin.*'))
        return false;
    }
    return this.allowed(identity, resource, `bulk.${actionId}`, undefined, actionId);
  }

  /**
   * Checks field-level read visibility.
   */
  public canViewField(
    identity: Identity | undefined,
    resource: AdminResource,
    fieldName: string
  ): boolean {
    if (!this.canAccessAdmin(identity)) return false;
    if (identity?.isSuperuser) return true;

    const field = resource.getField(fieldName);
    if (!field) return false;

    // Sensitive fields are hidden unless explicit permission exists
    if (field.sensitive) {
      const perm = `admin.${resource.id}.field.${fieldName}.view`;
      return Boolean(
        identity?.hasPermission(perm) || identity?.hasPermission(`admin.${resource.id}.sensitive`)
      );
    }

    return true;
  }

  /**
   * Checks field-level write permission.
   */
  public canEditField(
    identity: Identity | undefined,
    resource: AdminResource,
    fieldName: string
  ): boolean {
    if (!this.canAccessAdmin(identity)) return false;
    if (identity?.isSuperuser) return true;

    const field = resource.getField(fieldName);
    if (!field || field.readonly) return false;

    if (field.sensitive) {
      const perm = `admin.${resource.id}.field.${fieldName}.edit`;
      return Boolean(
        identity?.hasPermission(perm) || identity?.hasPermission(`admin.${resource.id}.sensitive`)
      );
    }

    return true;
  }

  /** Checks export permission (`admin.<resource>.export`). */
  public canExport(identity: Identity | undefined, resource: AdminResource) {
    return this.allowed(identity, resource, 'export');
  }

  /** Checks import permission (`admin.<resource>.import`). */
  public canImport(identity: Identity | undefined, resource: AdminResource) {
    return this.allowed(identity, resource, 'import');
  }
}
