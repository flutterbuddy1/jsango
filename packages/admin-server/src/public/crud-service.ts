import type { Identity } from '@jsango/auth';
import type { AdminResource, AdminResourceSchema } from '@jsango/admin-core';
import {
  AdminAuthorizationError,
  AdminItemNotFoundError,
  AdminResourceNotFoundError,
  AdminActionError,
} from '@jsango/admin-core';
import type { AdminPermissionChecker } from '@jsango/admin-auth';
import type { AdminAuditLogger } from '@jsango/admin-audit';
import type {
  IAdminQueryAdapter,
  AdminListQuery,
  AdminListResult,
  AdminRequestContext,
} from './types.js';

export interface AdminCrudServiceOptions {
  readonly queryAdapter: IAdminQueryAdapter;
  readonly permissions: AdminPermissionChecker;
  readonly audit: AdminAuditLogger;
}

/**
 * Orchestrates CRUD operations for a single Admin resource.
 * All operations enforce permission checks and emit audit events before returning.
 */
export class AdminCrudService {
  private readonly adapter: IAdminQueryAdapter;
  private readonly permissions: AdminPermissionChecker;
  private readonly audit: AdminAuditLogger;

  constructor(options: AdminCrudServiceOptions) {
    this.adapter = options.queryAdapter;
    this.permissions = options.permissions;
    this.audit = options.audit;
  }

  // ------------------------------------------------------------------
  // Schema
  // ------------------------------------------------------------------

  /**
   * Returns the resource schema visible to the given identity.
   * Sensitive fields are stripped for non-superusers.
   */
  public getSchema(resource: AdminResource, identity: Identity | undefined): AdminResourceSchema {
    if (!this.permissions.canAccessAdmin(identity)) {
      throw new AdminAuthorizationError({ resource: resource.id, action: 'schema' });
    }

    const schema = resource.getSchema();

    // Strip sensitive field definitions for non-superusers
    if (!identity?.isSuperuser) {
      const visibleFields = schema.fields.filter((f) =>
        this.permissions.canViewField(identity, resource, f.name)
      );
      return { ...schema, fields: visibleFields };
    }

    return schema;
  }

  // ------------------------------------------------------------------
  // List
  // ------------------------------------------------------------------

  public async list(
    resource: AdminResource,
    query: AdminListQuery,
    identity: Identity | undefined,
    _context?: AdminRequestContext | undefined
  ): Promise<AdminListResult> {
    if (!(await this.permissions.canViewResource(identity, resource))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: 'list' });
    }

    const result = await this.adapter.list({
      modelName: resource.modelName,
      query,
      searchFields: resource.searchFields,
      primaryKey: resource.primaryKey,
      defaultSortField: resource.defaultSortField ?? resource.primaryKey,
      defaultSortDirection: resource.defaultSortDirection,
      pageSize: resource.defaultPageSize,
      maxPageSize: resource.maxPageSize,
    });

    // Redact fields the actor cannot see
    const items = result.items.map((item) => this.filterFields(item, resource, identity, 'list'));

    return { ...result, items };
  }

  // ------------------------------------------------------------------
  // Detail
  // ------------------------------------------------------------------

  public async detail(
    resource: AdminResource,
    id: string | number,
    identity: Identity | undefined
  ): Promise<Record<string, unknown>> {
    if (!(await this.permissions.canViewResource(identity, resource))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: 'view' });
    }

    const item = await this.adapter.findById({
      modelName: resource.modelName,
      id,
      primaryKey: resource.primaryKey,
    });

    if (!item) {
      throw new AdminItemNotFoundError(resource.id, id);
    }

    return this.filterFields(item, resource, identity, 'detail');
  }

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  public async create(
    resource: AdminResource,
    rawData: Record<string, unknown>,
    identity: Identity | undefined,
    context?: AdminRequestContext | undefined
  ): Promise<Record<string, unknown>> {
    if (!(await this.permissions.canCreate(identity, resource))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: 'create' });
    }

    // Mass-assignment protection — only allow fields declared as createFields
    const safeData = this.pickAllowedFields(
      rawData,
      resource.createFields,
      resource,
      identity,
      'edit'
    );

    const created = await this.adapter.create({
      modelName: resource.modelName,
      data: safeData,
      primaryKey: resource.primaryKey,
    });

    void this.audit.log('create', {
      resourceId: resource.id,
      resourceLabel: resource.label,
      objectId: String(created[resource.primaryKey] ?? ''),
      objectRepresentation: this.represent(created, resource),
      actor: identity ? this.actorSnapshot(identity) : undefined,
      changes: Object.entries(safeData).map(([field, after]) => ({
        field,
        before: undefined,
        after,
      })),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.filterFields(created, resource, identity, 'detail');
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------

  public async update(
    resource: AdminResource,
    id: string | number,
    rawData: Record<string, unknown>,
    identity: Identity | undefined,
    context?: AdminRequestContext | undefined
  ): Promise<Record<string, unknown>> {
    // First fetch the existing record to do object-level auth check
    const existing = await this.adapter.findById({
      modelName: resource.modelName,
      id,
      primaryKey: resource.primaryKey,
    });

    if (!existing) {
      throw new AdminItemNotFoundError(resource.id, id);
    }

    if (!(await this.permissions.canUpdate(identity, resource, existing))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: 'update' });
    }

    const safeData = this.pickAllowedFields(
      rawData,
      resource.editFields,
      resource,
      identity,
      'edit'
    );

    const updated = await this.adapter.update({
      modelName: resource.modelName,
      id,
      data: safeData,
      primaryKey: resource.primaryKey,
    });

    const changes = this.audit.diffChanges(
      existing as Record<string, unknown>,
      updated,
      resource.editFields
    );

    void this.audit.log('update', {
      resourceId: resource.id,
      resourceLabel: resource.label,
      objectId: id,
      objectRepresentation: this.represent(updated, resource),
      actor: identity ? this.actorSnapshot(identity) : undefined,
      changes,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.filterFields(updated, resource, identity, 'detail');
  }

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  public async delete(
    resource: AdminResource,
    id: string | number,
    identity: Identity | undefined,
    context?: AdminRequestContext | undefined
  ): Promise<void> {
    const existing = await this.adapter.findById({
      modelName: resource.modelName,
      id,
      primaryKey: resource.primaryKey,
    });

    if (!existing) {
      throw new AdminItemNotFoundError(resource.id, id);
    }

    if (!(await this.permissions.canDelete(identity, resource, existing))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: 'delete' });
    }

    await this.adapter.delete({
      modelName: resource.modelName,
      id,
      primaryKey: resource.primaryKey,
      soft: resource.canSoftDelete,
    });

    void this.audit.log(resource.canSoftDelete ? 'delete' : 'delete', {
      resourceId: resource.id,
      resourceLabel: resource.label,
      objectId: id,
      objectRepresentation: this.represent(existing, resource),
      actor: identity ? this.actorSnapshot(identity) : undefined,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  // ------------------------------------------------------------------
  // Restore (soft delete)
  // ------------------------------------------------------------------

  public async restore(
    resource: AdminResource,
    id: string | number,
    identity: Identity | undefined,
    context?: AdminRequestContext | undefined
  ): Promise<Record<string, unknown>> {
    if (!resource.canSoftDelete) {
      throw new AdminResourceNotFoundError(resource.id);
    }

    if (!this.adapter.restore) {
      throw new AdminActionError({
        actionName: 'restore',
        message: 'The configured query adapter does not support restore.',
      });
    }

    const existing = await this.adapter.findById({
      modelName: resource.modelName,
      id,
      primaryKey: resource.primaryKey,
    });

    if (!existing) {
      throw new AdminItemNotFoundError(resource.id, id);
    }

    if (!(await this.permissions.canRestore(identity, resource, existing))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: 'restore' });
    }

    const restored = await this.adapter.restore({
      modelName: resource.modelName,
      id,
      primaryKey: resource.primaryKey,
    });

    void this.audit.log('restore', {
      resourceId: resource.id,
      resourceLabel: resource.label,
      objectId: id,
      objectRepresentation: this.represent(restored, resource),
      actor: identity ? this.actorSnapshot(identity) : undefined,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.filterFields(restored, resource, identity, 'detail');
  }

  // ------------------------------------------------------------------
  // Custom row action
  // ------------------------------------------------------------------

  public async executeAction(
    resource: AdminResource,
    actionId: string,
    id: string | number,
    input: unknown,
    identity: Identity | undefined,
    context?: AdminRequestContext | undefined
  ): Promise<unknown> {
    const action = resource.actions.get(actionId);
    if (!action) {
      throw new AdminActionError({ actionName: actionId, message: 'Action not found.' });
    }

    const item = await this.adapter.findById({
      modelName: resource.modelName,
      id,
      primaryKey: resource.primaryKey,
    });

    if (!item) {
      throw new AdminItemNotFoundError(resource.id, id);
    }

    if (!(await this.permissions.canExecuteAction(identity, resource, actionId, item))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: actionId });
    }

    if (!action.handler) {
      throw new AdminActionError({ actionName: actionId, message: 'Action has no handler.' });
    }

    let result: unknown;
    try {
      result = await action.handler({ item, input, actor: identity });
    } catch (err: unknown) {
      throw new AdminActionError({
        actionName: actionId,
        message: err instanceof Error ? err.message : 'Unknown error',
        cause: err,
      });
    }

    void this.audit.log('action', {
      resourceId: resource.id,
      resourceLabel: resource.label,
      objectId: id,
      actor: identity ? this.actorSnapshot(identity) : undefined,
      metadata: { actionId },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return result;
  }

  // ------------------------------------------------------------------
  // Bulk action
  // ------------------------------------------------------------------

  public async executeBulkAction(
    resource: AdminResource,
    actionId: string,
    ids: readonly (string | number)[],
    input: unknown,
    identity: Identity | undefined,
    context?: AdminRequestContext | undefined
  ): Promise<unknown> {
    const bulkAction = resource.bulkActions.get(actionId);
    if (!bulkAction) {
      throw new AdminActionError({ actionName: actionId, message: 'Bulk action not found.' });
    }

    if (!(await this.permissions.canExecuteBulkAction(identity, resource, actionId))) {
      throw new AdminAuthorizationError({ resource: resource.id, action: actionId });
    }

    if (!bulkAction.handler) {
      throw new AdminActionError({ actionName: actionId, message: 'Bulk action has no handler.' });
    }

    let result: unknown;
    try {
      result = await bulkAction.handler({ ids, input, actor: identity });
    } catch (err: unknown) {
      throw new AdminActionError({
        actionName: actionId,
        message: err instanceof Error ? err.message : 'Unknown error',
        cause: err,
      });
    }

    void this.audit.log('bulk_action', {
      resourceId: resource.id,
      resourceLabel: resource.label,
      actor: identity ? this.actorSnapshot(identity) : undefined,
      metadata: { actionId, ids, count: ids.length },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return result;
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Strips fields the actor cannot read for a given view context. */
  private filterFields(
    item: Record<string, unknown>,
    resource: AdminResource,
    identity: Identity | undefined,
    context: 'list' | 'detail'
  ): Record<string, unknown> {
    const visibleFieldNames = context === 'list' ? resource.listFields : resource.detailFields;

    const result: Record<string, unknown> = {};
    for (const fieldName of visibleFieldNames) {
      if (this.permissions.canViewField(identity, resource, fieldName)) {
        result[fieldName] = item[fieldName];
      }
    }
    return result;
  }

  /**
   * Restricts incoming data to the allowed field set and strips any fields
   * the actor cannot edit.
   */
  private pickAllowedFields(
    data: Record<string, unknown>,
    allowedFields: readonly string[],
    resource: AdminResource,
    identity: Identity | undefined,
    _context: 'edit'
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in data && this.permissions.canEditField(identity, resource, field)) {
        result[field] = data[field];
      }
    }
    return result;
  }

  private represent(item: Record<string, unknown>, resource: AdminResource): string {
    return String(
      item['name'] ?? item['title'] ?? item['label'] ?? item[resource.primaryKey] ?? ''
    );
  }

  private actorSnapshot(identity: Identity) {
    const meta = (identity.metadata ?? {}) as Record<string, unknown>;
    const username =
      typeof meta['username'] === 'string'
        ? (meta['username'] as string)
        : typeof (identity as unknown as { username?: string }).username === 'string'
          ? (identity as unknown as { username: string }).username
          : undefined;
    const email =
      typeof meta['email'] === 'string'
        ? (meta['email'] as string)
        : typeof (identity as unknown as { email?: string }).email === 'string'
          ? (identity as unknown as { email: string }).email
          : undefined;

    return {
      id: identity.id,
      username,
      email,
      roles: identity.roles ?? [],
      isSuperuser: identity.isSuperuser ?? false,
    };
  }
}
