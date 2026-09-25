import type { AdminUserIdentity } from '../types/index.js';

export interface AdminAuthState {
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly user?: AdminUserIdentity | undefined;
  readonly canAccessAdmin: boolean;
}

export type AuthListener = (state: AdminAuthState) => void;

export class AdminAuthManager {
  private state: AdminAuthState = {
    isAuthenticated: false,
    isLoading: true,
    user: undefined,
    canAccessAdmin: false,
  };

  private readonly listeners = new Set<AuthListener>();

  public getState(): AdminAuthState {
    return this.state;
  }

  public setUser(user: AdminUserIdentity | undefined, canAccessAdmin = true): void {
    this.state = {
      isAuthenticated: user !== undefined,
      isLoading: false,
      user,
      canAccessAdmin: user ? canAccessAdmin : false,
    };
    this.notify();
  }

  public setLoading(isLoading: boolean): void {
    this.state = {
      ...this.state,
      isLoading,
    };
    this.notify();
  }

  public logout(): void {
    this.state = {
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      canAccessAdmin: false,
    };
    this.notify();
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Permission & Role Checkers
  public hasRole(role: string): boolean {
    if (!this.state.user) return false;
    if (this.state.user.isSuperuser) return true;
    return this.state.user.roles.includes(role);
  }

  public hasPermission(permission: string): boolean {
    if (!this.state.user) return false;
    if (this.state.user.isSuperuser) return true;
    return this.state.user.permissions.includes(permission);
  }

  public canAccessResource(resourcePermission?: string): boolean {
    if (!this.state.canAccessAdmin) return false;
    if (!resourcePermission) return true;
    return this.hasPermission(resourcePermission);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Safe listener handling
      }
    }
  }
}
