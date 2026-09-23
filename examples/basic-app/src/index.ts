import { Application } from '@django-js/middleware';
import { DatabaseManager, MemoryDatabaseDriver } from '@django-js/database';

export function createApplication(): { app: Application; db: DatabaseManager } {
  const app = new Application({ isProduction: false });

  // 1. Initialize DatabaseManager with Memory driver and seed data
  const memoryDriver = new MemoryDatabaseDriver();
  memoryDriver.seed('users', [
    { id: 1, name: 'Alice Smith', email: 'alice@example.com' },
    { id: 2, name: 'Bob Jones', email: 'bob@example.com' },
  ]);

  const db = new DatabaseManager({
    default: 'default',
    connections: {
      default: {
        driver: 'memory',
        pool: { min: 2, max: 10 },
      },
    },
  });
  db.registerDriver('memory', memoryDriver);

  // Register DatabaseManager as singleton in DI container
  app.container.registerSingleton('db', () => db);

  // 2. Request-scoped service
  let requestCounter = 0;
  app.container.registerScoped('requestIdService', () => ({
    id: `req-${++requestCounter}`,
  }));

  // 3. Global Timing & Header Middleware
  app.use(async (ctx, next) => {
    const start = Date.now();
    const service = ctx.container?.resolve<{ id: string }>('requestIdService');
    const res = await next();
    const elapsed = Date.now() - start;
    res.headers.set('X-Response-Time', `${elapsed}ms`);
    if (service) {
      res.headers.set('X-Request-Id', service.id);
    }
    return res;
  });

  // 4. Named Route Middleware (Auth)
  app.registerMiddleware('apiKeyAuth', (ctx, next) => {
    const key = ctx.request.headers.get('x-api-key');
    if (key !== 'secret-key-123') {
      return { error: 'Invalid API key' };
    }
    return next();
  });

  // 5. Routes
  app.get('/', () => 'Welcome to Nexora!');

  app.group('/api/v1', (api) => {
    // Parameterized route with typed constraint fetching from database
    api.get('/users/:id<number>', async (ctx) => {
      const dbInstance = ctx.container?.resolve<DatabaseManager>('db') ?? db;
      const userId = Number(ctx.request.params['id']);
      const queryResult = await dbInstance.query('SELECT * FROM users WHERE id = ?', [userId]);

      const user = queryResult.rows[0];
      if (!user) {
        return { error: 'User not found' };
      }

      return user;
    });

    // Transactional route creating an audit log
    api.post('/audit-event', async (ctx) => {
      const dbInstance = ctx.container?.resolve<DatabaseManager>('db') ?? db;
      const result = await dbInstance.transaction(async (tx) => {
        await tx.query('INSERT INTO audit_logs (action, timestamp) VALUES (?, ?)', [
          'USER_ACTION',
          Date.now(),
        ]);
        return { status: 'recorded' };
      });
      return result;
    });

    // Guarded route using named middleware
    api.get('/secure-data', () => ({ secretPayload: 'CLASSIFIED' }), {
      middleware: ['apiKeyAuth'],
    });
  });

  return { app, db };
}

// Standalone execution entry
if (process.env['NODE_ENV'] !== 'test') {
  const { app, db } = createApplication();
  app.listen(3000, '127.0.0.1').then((server) => {
    console.log(`Server listening at http://127.0.0.1:${server.address?.port}`);

    // Graceful shutdown
    const cleanup = async () => {
      console.log('Shutting down server and closing database...');
      await server.close();
      await db.close();
      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  });
}
