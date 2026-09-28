export class RoleRegistry {
    roles = new Map();
    register(role) {
        if (this.roles.has(role.name)) {
            throw new Error(`Role "${role.name}" is already registered.`);
        }
        this.roles.set(role.name, Object.freeze({
            ...role,
            permissions: Object.freeze([...role.permissions]),
        }));
        return this;
    }
    registerMany(roles) {
        for (const role of roles) {
            this.register(role);
        }
        return this;
    }
    get(name) {
        return this.roles.get(name);
    }
    has(name) {
        return this.roles.has(name);
    }
    getPermissionsForRole(roleName) {
        const role = this.roles.get(roleName);
        return role ? role.permissions : [];
    }
    getPermissionsForRoles(roleNames) {
        const permissionsSet = new Set();
        for (const roleName of roleNames) {
            const permissions = this.getPermissionsForRole(roleName);
            for (const p of permissions) {
                permissionsSet.add(p);
            }
        }
        return Object.freeze(Array.from(permissionsSet));
    }
    getAll() {
        return Object.freeze(Array.from(this.roles.values()));
    }
}
//# sourceMappingURL=role.js.map