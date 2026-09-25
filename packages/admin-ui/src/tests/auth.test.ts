import { describe, it, expect } from 'vitest';
import { AdminAuthManager } from '../auth/auth-context.js';

describe('AdminAuthManager', () => {
  it('manages authentication state and permissions', () => {
    const auth = new AdminAuthManager();
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(auth.getState().isLoading).toBe(true);

    auth.setUser({
      id: 'usr_1',
      username: 'admin',
      roles: ['editor'],
      permissions: ['posts.create', 'posts.edit'],
      isSuperuser: false,
    });

    expect(auth.getState().isAuthenticated).toBe(true);
    expect(auth.getState().isLoading).toBe(false);
    expect(auth.hasRole('editor')).toBe(true);
    expect(auth.hasRole('admin')).toBe(false);
    expect(auth.hasPermission('posts.create')).toBe(true);
    expect(auth.hasPermission('posts.delete')).toBe(false);
    expect(auth.canAccessResource('posts.create')).toBe(true);
  });

  it('grants all permissions to superusers', () => {
    const auth = new AdminAuthManager();
    auth.setUser({
      id: 'usr_super',
      username: 'root',
      roles: ['superadmin'],
      permissions: [],
      isSuperuser: true,
    });

    expect(auth.hasPermission('any.random.permission')).toBe(true);
    expect(auth.hasRole('any.role')).toBe(true);
  });

  it('resets state on logout', () => {
    const auth = new AdminAuthManager();
    auth.setUser({
      id: 'usr_1',
      username: 'user',
      roles: [],
      permissions: [],
      isSuperuser: false,
    });

    auth.logout();
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(auth.getState().user).toBeUndefined();
  });
});
