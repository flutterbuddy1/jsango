import { describe, it, expect, beforeEach } from 'vitest';
import {
  createApp,
  model,
  fields,
  schema,
  string,
  number,
  email,
  validate,
  response,
  notFound,
  badRequest,
  events,
  jobs,
  cache,
  HttpRequest,
  RequestContext,
  DatabaseManager,
  setDatabaseManager,
} from './index.js';

describe('Phase 19 DX Overhaul — JSango Simplified Developer Experience', () => {
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    dbManager = new DatabaseManager({
      default: 'default',
      connections: {
        default: {
          driver: 'memory',
        },
      },
    });
    setDatabaseManager(dbManager);
  });

  it('allows creating an app and returning plain JSON objects', async () => {
    const app = createApp();

    app.get('/hello', () => ({
      message: 'Hello World from JSango',
      framework: 'jsango',
    }));

    const res = await app.handle(
      new HttpRequest({
        method: 'GET',
        url: 'http://localhost/hello',
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(res.body as string)).toEqual({
      message: 'Hello World from JSango',
      framework: 'jsango',
    });
  });

  it('supports explicit response helpers like response.created and response.noContent', async () => {
    const app = createApp();

    app.post('/items', () => response.created({ id: 'item-1', name: 'Widget' }));
    app.delete('/items/1', () => response.noContent());

    const createRes = await app.handle(
      new HttpRequest({ method: 'POST', url: 'http://localhost/items' })
    );
    expect(createRes.status).toBe(201);
    expect(JSON.parse(createRes.body as string)).toEqual({ id: 'item-1', name: 'Widget' });

    const deleteRes = await app.handle(
      new HttpRequest({ method: 'DELETE', url: 'http://localhost/items/1' })
    );
    expect(deleteRes.status).toBe(204);
  });

  it('handles throwable error helpers (notFound, badRequest) cleanly', async () => {
    const app = createApp();

    app.get('/protected', () => {
      throw badRequest('Missing required token');
    });

    app.get('/user/:id', () => {
      throw notFound('User not found');
    });

    const res400 = await app.handle(
      new HttpRequest({ method: 'GET', url: 'http://localhost/protected' })
    );
    expect(res400.status).toBe(400);
    expect(JSON.parse(res400.body as string).error.code).toBe('ERR_HTTP_BAD_REQUEST');

    const res404 = await app.handle(
      new HttpRequest({ method: 'GET', url: 'http://localhost/user/99' })
    );
    expect(res404.status).toBe(404);
    expect(JSON.parse(res404.body as string).error.code).toBe('ERR_HTTP_NOT_FOUND');
  });

  it('supports request validation with validate() and schema builders', async () => {
    const app = createApp();

    const UserInputSchema = schema({
      name: string().min(2),
      email: email(),
      age: number().int().min(18).optional(),
    });

    app.post('/users', validate(UserInputSchema), async (ctx: RequestContext) => {
      const data = ctx.state.get('validatedBody') as { name: string; email: string };
      return response.created({ id: 1, ...data });
    });

    // Invalid body
    const invalidRes = await app.handle(
      new HttpRequest({
        method: 'POST',
        url: 'http://localhost/users',
        body: JSON.stringify({ name: 'A', email: 'not-an-email' }),
      })
    );
    expect(invalidRes.status).toBe(400);
    const errBody = JSON.parse(invalidRes.body as string);
    expect(errBody.error.code).toBe('ERR_VALIDATION_FAILED');
    expect(errBody.error.details.length).toBeGreaterThanOrEqual(2);

    // Valid body
    const validRes = await app.handle(
      new HttpRequest({
        method: 'POST',
        url: 'http://localhost/users',
        body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
      })
    );
    expect(validRes.status).toBe(201);
    expect(JSON.parse(validRes.body as string)).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('provides simple model definitions and query builder ergonomics', async () => {
    const conn = await dbManager.connection('default');
    await conn.query(`
      CREATE TABLE test_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
      )
    `);

    const User = model({
      name: 'User',
      table: 'test_users',
      fields: {
        id: fields.id(),
        name: fields.string(),
        email: fields.string(),
        active: fields.boolean({ defaultValue: true }),
        createdAt: fields.dateTime({ nullable: true, columnName: 'created_at' }),
        updatedAt: fields.dateTime({ nullable: true, columnName: 'updated_at' }),
      },
    });

    // Create
    const user1 = await User.create({ name: 'Bob', email: 'bob@example.com' });
    expect(user1.get('name')).toBe('Bob');

    const user2 = await User.create({ name: 'Charlie', email: 'charlie@example.com' });
    expect(user2.get('name')).toBe('Charlie');

    // Query with static methods
    const allUsers = await User.all();
    expect(allUsers.length).toBe(2);

    const charlie = await User.where('email', 'charlie@example.com').first();
    expect(charlie?.get('name')).toBe('Charlie');

    const count = await User.count();
    expect(count).toBe(2);
  });

  it('supports automatic CRUD generation via app.crud()', async () => {
    const conn = await dbManager.connection('default');
    await conn.query(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL
      )
    `);

    const Product = model({
      name: 'Product',
      table: 'products',
      fields: {
        id: fields.id(),
        name: fields.string(),
        price: fields.float(),
      },
      timestamps: false,
    });

    const app = createApp();
    app.crud('/products', Product, { access: 'public' });

    // 1. POST /products (Create)
    const postRes = await app.handle(
      new HttpRequest({
        method: 'POST',
        url: 'http://localhost/products',
        body: JSON.stringify({ name: 'Laptop', price: 999.99 }),
      })
    );
    expect(postRes.status).toBe(201);
    const createdProduct = JSON.parse(postRes.body as string);
    expect(createdProduct.name).toBe('Laptop');
    const id = createdProduct.id;

    // 2. GET /products (List)
    const listRes = await app.handle(
      new HttpRequest({ method: 'GET', url: 'http://localhost/products' })
    );
    expect(listRes.status).toBe(200);
    const listData = JSON.parse(listRes.body as string);
    expect(listData.items.length).toBe(1);

    // 3. GET /products/:id (Detail)
    const getRes = await app.handle(
      new HttpRequest({ method: 'GET', url: `http://localhost/products/${id}` })
    );
    expect(getRes.status).toBe(200);
    expect(JSON.parse(getRes.body as string).name).toBe('Laptop');

    // 4. PUT /products/:id (Update)
    const putRes = await app.handle(
      new HttpRequest({
        method: 'PUT',
        url: `http://localhost/products/${id}`,
        body: JSON.stringify({ price: 899.99 }),
      })
    );
    expect(putRes.status).toBe(200);
    expect(JSON.parse(putRes.body as string).price).toBe(899.99);

    // 5. DELETE /products/:id (Delete)
    const delRes = await app.handle(
      new HttpRequest({ method: 'DELETE', url: `http://localhost/products/${id}` })
    );
    expect(delRes.status).toBe(204);

    // 6. Verify 404 after delete
    const getAfterDelete = await app.handle(
      new HttpRequest({ method: 'GET', url: `http://localhost/products/${id}` })
    );
    expect(getAfterDelete.status).toBe(404);
  });

  it('supports simplified Events facade', async () => {
    let receivedPayload: any = null;

    events.on<{ userId: string }>('user.signup', (data) => {
      receivedPayload = data;
    });

    await events.emit('user.signup', { userId: 'usr-123' });

    expect(receivedPayload).toEqual({ userId: 'usr-123' });
  });

  it('supports simplified Jobs facade', async () => {
    let jobExecuted = false;

    jobs.register<{ email: string }>('send-welcome-email', (payload) => {
      expect(payload.email).toBe('welcome@jsango.dev');
      jobExecuted = true;
    });

    const jobId = await jobs.dispatch('send-welcome-email', { email: 'welcome@jsango.dev' });
    expect(typeof jobId).toBe('string');
    expect(jobExecuted).toBe(true);
  });

  it('supports simplified Cache facade and remember()', async () => {
    await cache.set('test:key', 'cached-value');
    const val = await cache.get('test:key');
    expect(val).toBe('cached-value');

    let expensiveCalculationRan = 0;
    const compute = async () => {
      expensiveCalculationRan++;
      return { answer: 42 };
    };

    const first = await cache.remember('calc:key', 60, compute);
    expect(first).toEqual({ answer: 42 });
    expect(expensiveCalculationRan).toBe(1);

    const second = await cache.remember('calc:key', 60, compute);
    expect(second).toEqual({ answer: 42 });
    expect(expensiveCalculationRan).toBe(1); // Cached, did not re-run
  });

  it('registers WebSocket routes concisely on the app', () => {
    const app = createApp();

    app.ws('/chat', (socket) => {
      socket.on('message', (msg) => {
        socket.broadcast(msg);
      });
    });

    expect(typeof app.ws).toBe('function');
  });

  it('supports automatic OpenAPI generation', async () => {
    const app = createApp();
    app.get('/api/v1/ping', () => ({ status: 'pong' }));
    app.openapi({ path: '/api/v1/openapi.json', title: 'Test App API' });

    const res = await app.handle(
      new HttpRequest({ method: 'GET', url: 'http://localhost/api/v1/openapi.json' })
    );

    expect(res.status).toBe(200);
    const spec = JSON.parse(res.body as string);
    expect(spec.info.title).toBe('Test App API');
    expect(spec.paths['/api/v1/ping']).toBeDefined();
  });
});
