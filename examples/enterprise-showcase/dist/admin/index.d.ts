import { AdminRegistry } from '@jsango/admin-core';
import type { IAdminQueryAdapter } from '@jsango/admin-server';
export * from './user-resource.js';
export * from './product-resource.js';
export * from './order-resource.js';
export * from './pages-resource.js';
export declare function createAdminRegistry(): AdminRegistry;
/**
 * High-performance Query Adapter that bridges JSango ORM models with the Admin Server CRUD layer.
 */
export declare function createOrmAdminQueryAdapter(): IAdminQueryAdapter;
//# sourceMappingURL=index.d.ts.map