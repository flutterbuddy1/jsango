import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createApp,
  defineModel,
  fields,
  schema,
  string,
  number,
  forbidden,
  badRequest,
  HttpRequest,
  DatabaseManager,
  setDatabaseManager,
  type RequestContext,
} from './index.js';
import { clearDatabaseManager } from '@jsango/orm';

describe('app.crud access, writable fields, validation, scope and hooks', () => {
  let db: DatabaseManager;
  const Product = defineModel(
    'CrudProduct',
    {
      id: fields.id(),
      name: fields.string(),
      price: fields.float(),
      stock: fields.integer({ defaultValue: 0 }),
      ownerId: fields.string({ nullable: true }),
      secretToken: fields.string({ nullable: true }),
      isAdmin: fields.boolean({ defaultValue: false }),
    },
    { table: 'crud_products', registry: false }
  );

  beforeEach(async () => {
    db = new DatabaseManager({
      default: 'default',
      connections: { default: { driver: 'sqlite', filename: ':memory:' } },
    });
    setDatabaseManager(db);
    await db.query(
      'CREATE TABLE crud_products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL, stock INTEGER, ownerId TEXT, secretToken TEXT, isAdmin INTEGER DEFAULT 0)'
    );
  });
  afterEach(async () => {
    clearDatabaseManager();
    await db.close();
  });

  // Stand-in for auth.required(): the `x-user` header is the signed-in user.
  const signedIn = (ctx: RequestContext, next: () => Promise<unknown>) => {
    if (!ctx.request.headers.get('x-user')) throw forbidden('Sign in first');
    return next();
  };
  const user = (ctx: RequestContext) => ctx.request.headers.get('x-user')!;

  const call = async (
    app: ReturnType<typeof createApp>,
    method: string,
    path: string,
    body?: unknown,
    who?: string
  ) => {
    const res = await app.handle(
      new HttpRequest({
        method: method as 'GET',
        url: `http://localhost${path}`,
        headers: { 'content-type': 'application/json', ...(who ? { 'x-user': who } : {}) },
        body: body === undefined ? null : JSON.stringify(body),
      })
    );
    return { status: res.status, json: res.body ? JSON.parse(res.body as string) : undefined };
  };

  it('keeps reads public and refuses writes until access allows them', async () => {
    const app = createApp();
    app.crud('/products', Product);
    expect((await call(app, 'GET', '/products')).status).toBe(200);
    expect((await call(app, 'POST', '/products', { name: 'A', price: 1 })).status).toBe(403);

    const secured = createApp();
    secured.crud('/products', Product, { access: { write: signedIn } });
    expect((await call(secured, 'POST', '/products', { name: 'A', price: 1 })).status).toBe(403);
    expect((await call(secured, 'POST', '/products', { name: 'A', price: 1 }, 'u1')).status).toBe(
      201
    );
  });

  it('ignores non-writable body fields and hides sensitive ones', async () => {
    const app = createApp();
    app.crud('/products', Product, { access: 'public' });
    const { json } = await call(app, 'POST', '/products', {
      id: 999,
      name: 'A',
      price: 1,
      secretToken: 'x',
      isAdmin: true,
    });
    expect(json.id).not.toBe(999);
    expect(json.isAdmin).toBe(false); // privilege fields aren't writable by default
    expect(json).not.toHaveProperty('secretToken');
    const row = await Product.find(json.id);
    expect(row?.get('secretToken')).toBeNull();
  });

  it('validates creates and updates with the schema', async () => {
    const app = createApp();
    app.crud('/products', Product, {
      access: 'public',
      schema: schema({ name: string().min(2), price: number().min(0) }),
    });
    expect((await call(app, 'POST', '/products', { name: 'A', price: 1 })).status).toBe(400);
    const { json } = await call(app, 'POST', '/products', { name: 'Ok', price: 1 });
    expect((await call(app, 'PATCH', `/products/${json.id}`, { price: -5 })).status).toBe(400);
    expect((await call(app, 'PATCH', `/products/${json.id}`, { price: 5 })).json.price).toBe(5);
  });

  it('scopes queries and runs hooks in a transaction', async () => {
    const app = createApp();
    app.crud('/products', Product, {
      access: signedIn,
      only: ['list', 'detail', 'create', 'delete'],
      scope: (q, ctx) => q.where('ownerId', user(ctx)),
      hooks: {
        beforeCreate: (data, ctx) => ({ ...data, ownerId: user(ctx) }),
        beforeDelete: (item) => {
          if (Number(item.get('stock')) > 0) throw badRequest('Product still has stock');
        },
      },
    });

    const mine = (await call(app, 'POST', '/products', { name: 'A', price: 1, stock: 2 }, 'u1'))
      .json;
    expect(mine.ownerId).toBe('u1');
    await call(app, 'POST', '/products', { name: 'B', price: 1 }, 'u2');

    expect((await call(app, 'GET', '/products', undefined, 'u1')).json.items).toHaveLength(1);
    expect((await call(app, 'GET', `/products/${mine.id}`, undefined, 'u2')).status).toBe(404);
    expect((await call(app, 'DELETE', `/products/${mine.id}`, undefined, 'u2')).status).toBe(404);
    // `only` leaves update out
    expect((await call(app, 'PATCH', `/products/${mine.id}`, { price: 2 }, 'u1')).status).toBe(405);
    expect((await call(app, 'DELETE', `/products/${mine.id}`, undefined, 'u1')).status).toBe(400);
    expect(await Product.find(mine.id)).not.toBeNull();
  });

  it('rolls the write back when an after-hook throws', async () => {
    const app = createApp();
    app.crud('/products', Product, {
      access: 'public',
      hooks: {
        afterCreate: () => {
          throw badRequest('Out of coupons');
        },
      },
    });
    expect((await call(app, 'POST', '/products', { name: 'A', price: 1 })).status).toBe(400);
    expect(await Product.query().count()).toBe(0);
  });

  it('keeps privileges, hidden defaults and scope safe on writes', async () => {
    const app = createApp();
    app.crud('/products', Product, {
      access: signedIn,
      hidden: ['stock'], // adds to the defaults; secretToken stays hidden
      scope: (q, ctx) => q.where('ownerId', user(ctx)),
      hooks: { beforeCreate: (data, ctx) => ({ ...data, ownerId: user(ctx) }) },
      writable: ['name', 'price', 'ownerId'],
    });
    const mine = (
      await call(app, 'POST', '/products', { name: 'A', price: 1, isAdmin: true }, 'u1')
    ).json;
    expect(mine).not.toHaveProperty('secretToken');
    expect(mine).not.toHaveProperty('stock');
    expect(mine.isAdmin).toBe(false);

    // Moving the record to another owner is refused and rolled back.
    const moved = await call(app, 'PATCH', `/products/${mine.id}`, { ownerId: 'u2' }, 'u1');
    expect(moved.status).toBe(403);
    expect((await Product.find(mine.id))?.get('ownerId')).toBe('u1');

    expect((await call(app, 'GET', '/products?page=abc&pageSize=x', undefined, 'u1')).status).toBe(
      200
    );
  });
});
