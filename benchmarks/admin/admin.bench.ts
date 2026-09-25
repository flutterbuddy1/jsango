import { describe, bench } from 'vitest';
import { AdminRegistry, AdminResource } from '../../packages/admin-core/src/index.js';
import { AdminPermissionChecker } from '../../packages/admin-auth/src/index.js';
import { AdminAuditLogger, InMemoryAuditStore } from '../../packages/admin-audit/src/index.js';

describe('Admin Platform Benchmarks', () => {
  const registry = new AdminRegistry();
  const userResource = new AdminResource({
    id: 'users',
    modelName: 'User',
    fields: [
      { name: 'id', type: 'text', label: 'ID' },
      { name: 'email', type: 'email', label: 'Email', required: true },
      { name: 'password', type: 'password', label: 'Password', sensitive: true },
      { name: 'age', type: 'number', label: 'Age' },
      { name: 'isActive', type: 'boolean', label: 'Is Active' },
      { name: 'createdAt', type: 'date', label: 'Created At' },
    ],
    listFields: ['id', 'email', 'age', 'isActive'],
    searchFields: ['email'],
  });

  registry.register(userResource);

  const permissionChecker = new AdminPermissionChecker();
  const staffIdentity = {
    id: 'usr_admin',
    type: 'user',
    roles: ['admin', 'staff'],
    permissions: ['admin.access', 'users.view', 'users.create', 'users.update', 'users.delete'],
    metadata: { isStaff: true, isSuperuser: true },
  };

  const auditLogger = new AdminAuditLogger({
    store: new InMemoryAuditStore(),
  });

  describe('Admin Registry & Schema', () => {
    bench('resolve registered resource', () => {
      registry.getResource('users');
    });

    bench('generate resource schema representation', () => {
      userResource.getSchema();
    });
  });

  describe('Admin Authorization', () => {
    bench('check staff access permission', () => {
      permissionChecker.hasStaffAccess(staffIdentity);
    });

    bench('check resource action permission', () => {
      permissionChecker.canPerformAction(staffIdentity, userResource, 'view');
    });
  });

  describe('Admin Audit Trail', () => {
    bench('log create action with diff and redaction', async () => {
      await auditLogger.logAction({
        action: 'create',
        resourceSlug: 'users',
        recordId: '123',
        actor: staffIdentity,
        timestamp: new Date().toISOString(),
        changes: {
          email: { old: undefined, new: 'test@example.com' },
          password: { old: undefined, new: 'secret123' },
        },
      });
    });
  });
});
