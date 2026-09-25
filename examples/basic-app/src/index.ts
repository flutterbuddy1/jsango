import { Application } from '@django-js/middleware';
import { DatabaseManager, MemoryDatabaseDriver } from '@django-js/database';
import { defineModel, fields, relations, setDatabaseManager } from '@django-js/orm';
import {
  Migration,
  MigrationRegistry,
  MigrationRunner,
  CreateTableOperation,
} from '@django-js/migrations';

// 0. Schema Migrations Definition
export const initMigration = new Migration({
  id: '20260924000000_init_schema',
  name: 'init_schema',
  operations: [
    new CreateTableOperation({
      name: 'users',
      columns: [
        { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string', unique: true },
      ],
    }),
    new CreateTableOperation({
      name: 'posts',
      columns: [
        { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
        { name: 'userId', type: 'integer' },
        { name: 'title', type: 'string' },
      ],
    }),
  ],
});

export const migrationRegistry = new MigrationRegistry();
migrationRegistry.register(initMigration);

// 1. Define ORM Models
export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.integer({ primaryKey: true, autoIncrement: true }),
    name: fields.string(),
    email: fields.string({ unique: true }),
  },
  relations: {
    posts: relations.hasMany('Post', { foreignKey: 'userId' }),
  },
  timestamps: true,
});

export const Post = defineModel({
  name: 'Post',
  table: 'posts',
  fields: {
    id: fields.integer({ primaryKey: true, autoIncrement: true }),
    userId: fields.integer(),
    title: fields.string(),
  },
  relations: {
    user: relations.belongsTo('User', { foreignKey: 'userId' }),
  },
});

export function createApplication(): { app: Application; db: DatabaseManager } {
  const app = new Application({ isProduction: false });

  // 2. Initialize DatabaseManager with Memory driver and seed data
  const memoryDriver = new MemoryDatabaseDriver();
  memoryDriver.seed('users', [
    { id: 1, name: 'Alice Smith', email: 'alice@example.com' },
    { id: 2, name: 'Bob Jones', email: 'bob@example.com' },
  ]);
  memoryDriver.seed('posts', [
    { id: 1, userId: 1, title: 'First Post by Alice' },
    { id: 2, userId: 1, title: 'Second Post by Alice' },
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
  setDatabaseManager(db);

  // Register DatabaseManager as singleton in DI container
  app.container.registerSingleton('db', () => db);

  // 3. Request-scoped service
  let requestCounter = 0;
  app.container.registerScoped('requestIdService', () => ({
    id: `req-${++requestCounter}`,
  }));

  // 4. Global Timing & Header Middleware
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

  // 5. Named Route Middleware (Auth)
  app.registerMiddleware('apiKeyAuth', (ctx, next) => {
    const key = ctx.request.headers.get('x-api-key');
    if (key !== 'secret-key-123') {
      return { error: 'Invalid API key' };
    }
    return next();
  });

  // 6. Routes
  app.get('/', () => 'Welcome to Nexora!');

  app.group('/api/v1', (api) => {
    // Model lookup via ORM find()
    api.get('/users/:id<number>', async (ctx) => {
      const userId = Number(ctx.request.params['id']);
      const user = await User.find(userId);
      if (!user) {
        return { error: 'User not found' };
      }
      return user.toJSON();
    });

    // Relation eager-loading via ORM with('posts')
    api.get('/users/:id<number>/posts', async (ctx) => {
      const userId = Number(ctx.request.params['id']);
      const user = await User.query().where('id', userId).with('posts').first();
      if (!user) {
        return { error: 'User not found' };
      }
      return user.toJSON();
    });

    // Transactional route creating a Post via ORM
    api.post('/audit-event', async (ctx) => {
      const dbInstance = ctx.container?.resolve<DatabaseManager>('db') ?? db;
      return dbInstance.transaction(async (tx) => {
        const post = new Post({ userId: 1, title: 'Audit Triggered Post' });
        await post.save({ connection: tx });
        return { status: 'recorded', postId: post.id };
      });
    });

    // Guarded route using named middleware
    api.get('/secure-data', () => ({ secretPayload: 'CLASSIFIED' }), {
      middleware: ['apiKeyAuth'],
    });

    // Migrations status endpoint
    api.get('/migrations/status', async () => {
      const runner = new MigrationRunner({ databaseManager: db, registry: migrationRegistry });
      const status = await runner.status();
      return {
        isUpToDate: status.isUpToDate,
        appliedCount: status.applied.length,
        pendingCount: status.pending.length,
      };
    });

    // Run migrations endpoint
    api.post('/migrations/run', async () => {
      const runner = new MigrationRunner({ databaseManager: db, registry: migrationRegistry });
      const result = await runner.migrate();
      return {
        applied: result.applied,
        batch: result.batch,
      };
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
