import { AdminAuthorizationError, AdminItemNotFoundError, AdminResourceNotFoundError, AdminActionError, } from '@jsango/admin-core';
/**
 * Orchestrates CRUD operations for a single Admin resource.
 * All operations enforce permission checks and emit audit events before returning.
 */
export class AdminCrudService {
    adapter;
    permissions;
    audit;
    constructor(options) {
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
    getSchema(resource, identity) {
        if (!this.permissions.canAccessAdmin(identity)) {
            throw new AdminAuthorizationError({ resource: resource.id, action: 'schema' });
        }
        const schema = resource.getSchema();
        // Strip sensitive field definitions for non-superusers
        if (!identity?.isSuperuser) {
            const visibleFields = schema.fields.filter((f) => this.permissions.canViewField(identity, resource, f.name));
            return { ...schema, fields: visibleFields };
        }
        return schema;
    }
    // ------------------------------------------------------------------
    // List
    // ------------------------------------------------------------------
    async list(resource, query, identity, _context) {
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
    async detail(resource, id, identity) {
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
    async create(resource, rawData, identity, context) {
        if (!(await this.permissions.canCreate(identity, resource))) {
            throw new AdminAuthorizationError({ resource: resource.id, action: 'create' });
        }
        // Mass-assignment protection — only allow fields declared as createFields
        const safeData = this.pickAllowedFields(rawData, resource.createFields, resource, identity, 'edit');
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
    async update(resource, id, rawData, identity, context) {
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
        const safeData = this.pickAllowedFields(rawData, resource.editFields, resource, identity, 'edit');
        const updated = await this.adapter.update({
            modelName: resource.modelName,
            id,
            data: safeData,
            primaryKey: resource.primaryKey,
        });
        const changes = this.audit.diffChanges(existing, updated, resource.editFields);
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
    async delete(resource, id, identity, context) {
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
    async restore(resource, id, identity, context) {
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
    async executeAction(resource, actionId, id, input, identity, context) {
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
        let result;
        try {
            result = await action.handler({ item, input, actor: identity });
        }
        catch (err) {
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
    async executeBulkAction(resource, actionId, ids, input, identity, context) {
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
        let result;
        try {
            result = await bulkAction.handler({ ids, input, actor: identity });
        }
        catch (err) {
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
    filterFields(item, resource, identity, context) {
        const visibleFieldNames = context === 'list' ? resource.listFields : resource.detailFields;
        const result = {};
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
    pickAllowedFields(data, allowedFields, resource, identity, _context) {
        const result = {};
        for (const field of allowedFields) {
            if (field in data && this.permissions.canEditField(identity, resource, field)) {
                result[field] = data[field];
            }
        }
        return result;
    }
    represent(item, resource) {
        return String(item['name'] ?? item['title'] ?? item['label'] ?? item[resource.primaryKey] ?? '');
    }
    actorSnapshot(identity) {
        const meta = (identity.metadata ?? {});
        const username = typeof meta['username'] === 'string'
            ? meta['username']
            : typeof identity.username === 'string'
                ? identity.username
                : undefined;
        const email = typeof meta['email'] === 'string'
            ? meta['email']
            : typeof identity.email === 'string'
                ? identity.email
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
//# sourceMappingURL=crud-service.js.map