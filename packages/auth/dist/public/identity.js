export class BaseIdentity {
    id;
    type;
    isAuthenticated;
    isSuperuser;
    roles;
    permissions;
    tenantId;
    metadata;
    constructor(options) {
        this.id = options.id;
        this.type = options.type ?? 'user';
        this.isAuthenticated = options.isAuthenticated ?? false;
        this.isSuperuser = options.isSuperuser ?? false;
        this.roles = Object.freeze([...(options.roles ?? [])]);
        this.permissions = Object.freeze([...(options.permissions ?? [])]);
        this.tenantId = options.tenantId;
        this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    }
    hasRole(role) {
        if (this.isSuperuser) {
            return true;
        }
        return this.roles.includes(role);
    }
    hasPermission(permission) {
        if (this.isSuperuser) {
            return true;
        }
        if (this.permissions.includes('*')) {
            return true;
        }
        if (this.permissions.includes(permission)) {
            return true;
        }
        // Wildcard matching: e.g. "users.*" matches "users.read"
        const dotIndex = permission.indexOf('.');
        if (dotIndex !== -1) {
            const namespace = permission.slice(0, dotIndex);
            if (this.permissions.includes(`${namespace}.*`)) {
                return true;
            }
        }
        return false;
    }
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            isAuthenticated: this.isAuthenticated,
            isSuperuser: this.isSuperuser,
            roles: this.roles,
            permissions: this.permissions,
            tenantId: this.tenantId,
            metadata: this.metadata,
        };
    }
}
export class UserIdentity extends BaseIdentity {
    constructor(options) {
        super({
            ...options,
            type: options.type ?? 'user',
            isAuthenticated: true,
        });
    }
}
export class AnonymousIdentity extends BaseIdentity {
    constructor() {
        super({
            id: 'anonymous',
            type: 'anonymous',
            isAuthenticated: false,
            isSuperuser: false,
            roles: [],
            permissions: [],
        });
    }
}
export class SystemIdentity extends BaseIdentity {
    constructor(options = {}) {
        super({
            ...options,
            id: 'system',
            type: 'system',
            isAuthenticated: true,
            isSuperuser: true,
            roles: ['system'],
            permissions: ['*'],
        });
    }
}
export class ServiceAccountIdentity extends BaseIdentity {
    constructor(options) {
        super({
            ...options,
            type: 'service_account',
            isAuthenticated: true,
        });
    }
}
//# sourceMappingURL=identity.js.map