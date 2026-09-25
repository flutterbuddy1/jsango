import { describe, it, expect } from 'vitest';
import { UserIdentity, AnonymousIdentity } from '@jsango/auth';
import { AdminResource } from '@jsango/admin-core';
import { AdminPermissionChecker } from '../public/checker.js';

describe('AdminPermissionChecker', () => {
  const resource = new AdminResource({
    id: 'orders',
    modelName: 'Order',
    fields: [
      { name: 'id', type: 'number' },
      { name: 'total', type: 'number' },
      { name: 'apiKey', type: 'text', sensitive: true },
    ],
    actions: [{ id: 'refund', label: 'Refund', permission: 'admin.orders.refund' }],
    bulkActions: [{ id: 'bulkCancel', label: 'Cancel' }],
  });

  it('denies unauthenticated / anonymous users', async () => {
    const checker = new AdminPermissionChecker();
    const anon = new AnonymousIdentity();

    expect(checker.canAccessAdmin(anon)).toBe(false);
    expect(await checker.canViewResource(anon, resource)).toBe(false);
  });

  it('allows superusers access to all resources and fields', async () => {
    const checker = new AdminPermissionChecker();
    const superuser = new UserIdentity({
      id: '1',
      username: 'admin',
      isSuperuser: true,
    });

    expect(checker.canAccessAdmin(superuser)).toBe(true);
    expect(await checker.canViewResource(superuser, resource)).toBe(true);
    expect(await checker.canCreate(superuser, resource)).toBe(true);
    expect(await checker.canDelete(superuser, resource)).toBe(true);
    expect(checker.canViewField(superuser, resource, 'apiKey')).toBe(true);
  });

  it('enforces sensitive field protection for standard staff', () => {
    const checker = new AdminPermissionChecker();
    const staff = new UserIdentity({
      id: '2',
      username: 'staff',
      roles: ['staff'],
    });

    expect(checker.canAccessAdmin(staff)).toBe(true);
    expect(checker.canViewField(staff, resource, 'total')).toBe(true);
    // Sensitive field masked without explicit sensitive field permission
    expect(checker.canViewField(staff, resource, 'apiKey')).toBe(false);
  });
});
