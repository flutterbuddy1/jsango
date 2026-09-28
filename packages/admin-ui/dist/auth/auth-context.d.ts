import type { AdminUserIdentity } from '../types/index.js';
export interface AdminAuthState {
    readonly isAuthenticated: boolean;
    readonly isLoading: boolean;
    readonly user?: AdminUserIdentity | undefined;
    readonly canAccessAdmin: boolean;
}
export type AuthListener = (state: AdminAuthState) => void;
export declare class AdminAuthManager {
    private state;
    private readonly listeners;
    getState(): AdminAuthState;
    setUser(user: AdminUserIdentity | undefined, canAccessAdmin?: boolean): void;
    setLoading(isLoading: boolean): void;
    logout(): void;
    subscribe(listener: AuthListener): () => void;
    hasRole(role: string): boolean;
    hasPermission(permission: string): boolean;
    canAccessResource(resourcePermission?: string): boolean;
    private notify;
}
//# sourceMappingURL=auth-context.d.ts.map