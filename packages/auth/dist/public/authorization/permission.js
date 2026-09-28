export class PermissionRegistry {
    permissions = new Map();
    register(permission) {
        if (this.permissions.has(permission.name)) {
            throw new Error(`Permission "${permission.name}" is already registered.`);
        }
        this.permissions.set(permission.name, Object.freeze({ ...permission }));
        return this;
    }
    registerMany(permissions) {
        for (const permission of permissions) {
            this.register(permission);
        }
        return this;
    }
    get(name) {
        return this.permissions.get(name);
    }
    has(name) {
        return this.permissions.has(name);
    }
    getAll() {
        return Object.freeze(Array.from(this.permissions.values()));
    }
    /**
     * Deterministically test if any granted permission matches the requested permission.
     * Supports exact match, superuser wildcard '*', and namespace wildcards (e.g. 'users.*' matches 'users.read').
     */
    static matches(grantedPermissions, requestedPermission) {
        if (grantedPermissions.includes('*')) {
            return true;
        }
        if (grantedPermissions.includes(requestedPermission)) {
            return true;
        }
        const dotIndex = requestedPermission.indexOf('.');
        if (dotIndex !== -1) {
            const namespace = requestedPermission.slice(0, dotIndex);
            if (grantedPermissions.includes(`${namespace}.*`)) {
                return true;
            }
        }
        return false;
    }
}
//# sourceMappingURL=permission.js.map