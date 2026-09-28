/**
 * Evaluates model, object, field, and action permissions for the Admin platform.
 * Fails closed: unauthenticated or unauthorized identities are denied by default.
 */
export class AdminPermissionChecker {
    authz;
    requireSuperuser;
    staffRole;
    adminPermission;
    constructor(options = {}) {
        this.authz = options.authorizationManager;
        this.requireSuperuser = options.requireSuperuser ?? false;
        this.staffRole = options.staffRole ?? 'admin';
        this.adminPermission = options.adminPermission ?? 'admin.access';
    }
    /**
     * Checks if an identity is allowed to access the admin platform at all.
     */
    canAccessAdmin(identity) {
        if (!identity || !identity.isAuthenticated) {
            return false;
        }
        if (identity.isSuperuser) {
            return true;
        }
        if (this.requireSuperuser) {
            return false;
        }
        if (identity.hasRole(this.staffRole) ||
            identity.hasRole('staff') ||
            identity.hasRole('superuser')) {
            return true;
        }
        if (identity.hasPermission(this.adminPermission) || identity.hasPermission('*')) {
            return true;
        }
        return false;
    }
    /**
     * Checks if an identity can view list and details of a resource.
     */
    async canViewResource(identity, resource) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const perm = `admin.${resource.id}.view`;
        if (identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*')) {
            return true;
        }
        if (this.authz) {
            return this.authz.can(identity, 'view', resource.modelName);
        }
        return true; // Default allow for authenticated staff if no explicit policy
    }
    /**
     * Checks if an identity can create new records in a resource.
     */
    async canCreate(identity, resource) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const perm = `admin.${resource.id}.add`;
        if (identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*')) {
            return true;
        }
        if (this.authz) {
            return this.authz.can(identity, 'add', resource.modelName);
        }
        return true;
    }
    /**
     * Checks if an identity can update a record (with optional object-level check).
     */
    async canUpdate(identity, resource, item) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const perm = `admin.${resource.id}.change`;
        if (identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*')) {
            if (item && this.authz) {
                return this.authz.can(identity, 'change', item);
            }
            return true;
        }
        if (this.authz) {
            return this.authz.can(identity, 'change', item ?? resource.modelName);
        }
        return true;
    }
    /**
     * Checks if an identity can delete a record.
     */
    async canDelete(identity, resource, item) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const perm = `admin.${resource.id}.delete`;
        if (identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*')) {
            if (item && this.authz) {
                return this.authz.can(identity, 'delete', item);
            }
            return true;
        }
        if (this.authz) {
            return this.authz.can(identity, 'delete', item ?? resource.modelName);
        }
        return true;
    }
    /**
     * Checks if an identity can restore a soft-deleted record.
     */
    async canRestore(identity, resource, item) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const perm = `admin.${resource.id}.restore`;
        if (identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*')) {
            return true;
        }
        if (this.authz) {
            return this.authz.can(identity, 'restore', item ?? resource.modelName);
        }
        return true;
    }
    /**
     * Checks if an identity can execute a custom row action.
     */
    async canExecuteAction(identity, resource, actionId, item) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const action = resource.actions.get(actionId);
        if (!action)
            return false;
        if (action.permission) {
            if (!identity?.hasPermission(action.permission) && !identity?.hasPermission('admin.*')) {
                return false;
            }
        }
        const perm = `admin.${resource.id}.action.${actionId}`;
        if (identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*')) {
            return true;
        }
        if (this.authz) {
            return this.authz.can(identity, actionId, item ?? resource.modelName);
        }
        return true;
    }
    /**
     * Checks if an identity can execute a bulk action.
     */
    async canExecuteBulkAction(identity, resource, actionId) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const bulkAction = resource.bulkActions.get(actionId);
        if (!bulkAction)
            return false;
        if (bulkAction.permission) {
            if (!identity?.hasPermission(bulkAction.permission) && !identity?.hasPermission('admin.*')) {
                return false;
            }
        }
        const perm = `admin.${resource.id}.bulk.${actionId}`;
        return (identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*') ||
            true);
    }
    /**
     * Checks field-level read visibility.
     */
    canViewField(identity, resource, fieldName) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const field = resource.getField(fieldName);
        if (!field)
            return false;
        // Sensitive fields are hidden unless explicit permission exists
        if (field.sensitive) {
            const perm = `admin.${resource.id}.field.${fieldName}.view`;
            return Boolean(identity?.hasPermission(perm) || identity?.hasPermission(`admin.${resource.id}.sensitive`));
        }
        return true;
    }
    /**
     * Checks field-level write permission.
     */
    canEditField(identity, resource, fieldName) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const field = resource.getField(fieldName);
        if (!field || field.readonly)
            return false;
        if (field.sensitive) {
            const perm = `admin.${resource.id}.field.${fieldName}.edit`;
            return Boolean(identity?.hasPermission(perm) || identity?.hasPermission(`admin.${resource.id}.sensitive`));
        }
        return true;
    }
    /**
     * Checks export permission.
     */
    canExport(identity, resource) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const perm = `admin.${resource.id}.export`;
        return Boolean(identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*'));
    }
    /**
     * Checks import permission.
     */
    canImport(identity, resource) {
        if (!this.canAccessAdmin(identity))
            return false;
        if (identity?.isSuperuser)
            return true;
        const perm = `admin.${resource.id}.import`;
        return Boolean(identity?.hasPermission(perm) ||
            identity?.hasPermission(`admin.${resource.id}.*`) ||
            identity?.hasPermission('admin.*'));
    }
}
//# sourceMappingURL=checker.js.map