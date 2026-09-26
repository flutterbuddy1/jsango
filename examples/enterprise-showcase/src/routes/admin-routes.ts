import type { IRouter } from '@jsango/router';
import { AdminPermissionChecker } from '@jsango/admin-auth';
import { AdminAuditLogger, InMemoryAuditStore } from '@jsango/admin-audit';
import { AdminServer } from '@jsango/admin-server';
import { createAdminUiHandler } from '@jsango/admin-ui';
import { createAdminRegistry, createOrmAdminQueryAdapter } from '../admin/index.js';

export function registerAdminRoutes(router: IRouter): AdminServer {
  const registry = createAdminRegistry();
  const queryAdapter = createOrmAdminQueryAdapter();
  const permissions = new AdminPermissionChecker();
  const audit = new AdminAuditLogger({ store: new InMemoryAuditStore() });

  const adminServer = new AdminServer({
    registry,
    queryAdapter,
    permissions,
    audit,
    prefix: '/api/admin',
  });

  // 1. Mount REST API routes for Admin Console
  adminServer.mount(router);

  // 2. Mount Interactive Admin Console UI directly from @jsango/admin-ui package
  const adminUiHandler = createAdminUiHandler({
    title: 'JSango Administration',
    brandSubtitle: 'Enterprise Management Console',
    apiPrefix: '/api/admin',
    defaultTheme: 'dark',
  });

  router.get('/admin', adminUiHandler);

  return adminServer;
}
