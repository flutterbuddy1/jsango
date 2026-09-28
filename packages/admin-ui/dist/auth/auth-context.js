export class AdminAuthManager {
    state = {
        isAuthenticated: false,
        isLoading: true,
        user: undefined,
        canAccessAdmin: false,
    };
    listeners = new Set();
    getState() {
        return this.state;
    }
    setUser(user, canAccessAdmin = true) {
        this.state = {
            isAuthenticated: user !== undefined,
            isLoading: false,
            user,
            canAccessAdmin: user ? canAccessAdmin : false,
        };
        this.notify();
    }
    setLoading(isLoading) {
        this.state = {
            ...this.state,
            isLoading,
        };
        this.notify();
    }
    logout() {
        this.state = {
            isAuthenticated: false,
            isLoading: false,
            user: undefined,
            canAccessAdmin: false,
        };
        this.notify();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    // Permission & Role Checkers
    hasRole(role) {
        if (!this.state.user)
            return false;
        if (this.state.user.isSuperuser)
            return true;
        return this.state.user.roles.includes(role);
    }
    hasPermission(permission) {
        if (!this.state.user)
            return false;
        if (this.state.user.isSuperuser)
            return true;
        return this.state.user.permissions.includes(permission);
    }
    canAccessResource(resourcePermission) {
        if (!this.state.canAccessAdmin)
            return false;
        if (!resourcePermission)
            return true;
        return this.hasPermission(resourcePermission);
    }
    notify() {
        for (const listener of this.listeners) {
            try {
                listener(this.state);
            }
            catch {
                // Safe listener handling
            }
        }
    }
}
//# sourceMappingURL=auth-context.js.map