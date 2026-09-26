import { Application } from '@jsango/middleware';
import { DatabaseManager } from '@jsango/database';
import { setDatabaseManager } from '@jsango/orm';
import { CacheStore, MemoryCacheDriver } from '@jsango/cache';
import { QueueManager, JobRegistry } from '@jsango/queue';
import { EventBus } from '@jsango/events';
import { User, Product, Order, Page } from './models/index.js';
import { StoreService } from './services/store-service.js';
import { registerApiRoutes } from './routes/api-routes.js';
import { registerAdminRoutes } from './routes/admin-routes.js';
import {
  ORDER_NOTIFICATION_JOB_TYPE,
  handleOrderNotificationJob,
} from './jobs/order-notification-job.js';
import { ORDER_CREATED_EVENT } from './events/order-created-event.js';

export interface EnterpriseAppInstance {
  app: Application;
  dbManager: DatabaseManager;
  cache: CacheStore;
  queue: QueueManager;
  eventBus: EventBus;
  storeService: StoreService;
}

export async function createEnterpriseApp(): Promise<EnterpriseAppInstance> {
  // 1. Initialize In-Memory Database Manager and Bind to ORM
  const dbManager = new DatabaseManager({
    default: 'default',
    connections: {
      default: {
        driver: 'memory',
      },
    },
  });
  setDatabaseManager(dbManager);

  // 2. Seed Initial Demonstration Data (Users, Catalog Products, Orders)
  await seedInitialData();

  // 3. Initialize Cache Subsystem (In-Memory Driver with TTL)
  const cacheDriver = new MemoryCacheDriver();
  const cache = new CacheStore({
    driver: cacheDriver,
    defaultTtlMs: 60000,
  });

  // 4. Initialize Job Queue Subsystem (In-Memory Driver with Retry Policies)
  const jobRegistry = new JobRegistry();
  jobRegistry.register({
    type: ORDER_NOTIFICATION_JOB_TYPE,
    handler: handleOrderNotificationJob,
  });

  const queue = new QueueManager(undefined, {
    registry: jobRegistry,
  });

  // 5. Initialize Typed Event Dispatcher
  const eventBus = new EventBus();
  eventBus.on(ORDER_CREATED_EVENT, () => {
    // In-process event reaction
  });

  // 6. Initialize Core Store Service
  const storeService = new StoreService(cache, queue, eventBus);

  // 7. Create JSango Application Pipeline
  const app = new Application({
    isProduction: false,
  });

  // 8. Register Public REST API and Admin Console Platform
  registerApiRoutes(app.router, storeService);
  registerAdminRoutes(app.router);

  return {
    app,
    dbManager,
    cache,
    queue,
    eventBus,
    storeService,
  };
}

async function seedInitialData(): Promise<void> {
  // Seed Users
  await User.create({
    id: 'usr-admin-01',
    email: 'admin@jsango.dev',
    name: 'System Administrator',
    role: 'admin',
    isStaff: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  } as never);

  await User.create({
    id: 'usr-staff-01',
    email: 'staff@jsango.dev',
    name: 'Sarah Connor',
    role: 'staff',
    isStaff: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  } as never);

  await User.create({
    id: 'usr-cust-01',
    email: 'alex@example.com',
    name: 'Alex Mercer',
    role: 'customer',
    isStaff: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  } as never);

  // Seed Products
  await Product.create({
    id: 'prod-01',
    sku: 'SKU-AUDIO-001',
    name: 'Wireless Noise-Canceling Headphones',
    category: 'Audio',
    price: 249.99,
    stock: 50,
    isActive: true,
    createdAt: new Date().toISOString(),
  } as never);

  await Product.create({
    id: 'prod-02',
    sku: 'SKU-KB-102',
    name: 'Mechanical RGB Hot-Swap Keyboard',
    category: 'Electronics',
    price: 139.5,
    stock: 35,
    isActive: true,
    createdAt: new Date().toISOString(),
  } as never);

  await Product.create({
    id: 'prod-03',
    sku: 'SKU-WATCH-99',
    name: 'Smart OLED Fitness Watch',
    category: 'Wearables',
    price: 189.0,
    stock: 80,
    isActive: true,
    createdAt: new Date().toISOString(),
  } as never);

  await Product.create({
    id: 'prod-04',
    sku: 'SKU-MOUSE-20',
    name: 'Ergonomic Wireless Trackball Mouse',
    category: 'Accessories',
    price: 79.99,
    stock: 100,
    isActive: true,
    createdAt: new Date().toISOString(),
  } as never);

  // Seed Initial Order
  await Order.create({
    id: 'ord-01',
    orderNumber: 'ORD-DEMO-001',
    customerEmail: 'alex@example.com',
    totalAmount: 389.49,
    status: 'paid',
    itemCount: 2,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  } as never);

  // Seed Initial Pages
  await Page.create({
    id: 'page-01',
    title: 'About JSango Framework',
    description: 'Enterprise-grade TypeScript web application framework.',
    content:
      'JSango brings batteries-included developer happiness to high-performance Node.js and Bun applications.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);

  await Page.create({
    id: 'page-02',
    title: 'Terms of Service & Privacy',
    description: 'Usage terms, compliance policies, and privacy disclosures.',
    content:
      'All user data is encrypted in transit and at rest with strict zero-trust security invariants.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}
