/**
 * The admin panel over real HTTP on SQLite: login security, list queries on a few thousand rows,
 * bulk delete, streamed CSV export, dashboards, custom pages, health checks and sessions.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../packages/database/dist/index.js';
import {
  createApp,
  createAuth,
  defineModel,
  fields,
  setDatabaseManager,
  AdminResource,
  AdminPage,
  MetricWidget,
  ChartWidget,
} from '../packages/jsango/dist/index.js';
import { clearDatabaseManager } from '../packages/orm/dist/index.js';
import { renderAdminSpaHtml } from '../packages/admin-ui/dist/index.js';

const ROWS = 2500;

const Product = defineModel(
  'AdminProduct',
  {
    id: fields.id(),
    name: fields.string(),
    sku: fields.string(),
    price: fields.integer(),
    active: fields.boolean({ defaultValue: true }),
    notes: fields.text({ nullable: true }),
  },
  { table: 'admin_products' }
);

const Ticket = defineModel(
  'AdminTicket',
  {
    id: fields.id(),
    subject: fields.string(),
  },
  { table: 'admin_tickets' }
);

let db: InstanceType<typeof DatabaseManager>;

beforeAll(async () => {
  db = new DatabaseManager({
    default: 'default',
    connections: { default: { driver: 'sqlite', filename: ':memory:' } },
  });
  setDatabaseManager(db);
  await db.query(
    'CREATE TABLE admin_products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, sku TEXT, price INTEGER, active INTEGER, notes TEXT)'
  );
  await db.query('CREATE TABLE admin_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT)');
  await Product.bulkCreate(
    Array.from({ length: ROWS }, (_, i) => ({
      name: i === 7 ? '=HYPERLINK("http://evil")' : `Product ${i}`,
      sku: `SKU-${String(i).padStart(5, '0')}`,
      price: i,
      active: i % 2 === 0,
      notes: 'internal',
    }))
  );
  await Ticket.bulkCreate(Array.from({ length: 30 }, (_, i) => ({ subject: `Ticket ${i}` })));
});

afterAll(async () => {
  clearDatabaseManager();
  await db.close();
});

async function start(configure: (app: ReturnType<typeof createApp>) => void) {
  const app = createApp();
  configure(app);
  const server = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${server.address!.port}/admin/api/v1`;
  const call = async (
    method: string,
    path: string,
    opts: { body?: unknown; token?: string } = {}
  ) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json, data: json?.data, text, headers: res.headers };
  };
  const login = async (email: string, password: string) =>
    (await call('POST', '/auth/login', { body: { email, password } })).data?.token as string;
  return { server, call, login, close: () => server.close() };
}

describe('admin panel', () => {
  let h: Awaited<ReturnType<typeof start>>;
  let token: string;
  let widgetCalls = 0;

  beforeAll(async () => {
    h = await start((app) =>
      app.admin({
        auth: { email: 'root@example.com', password: 'a-long-admin-password' },
        resources: [
          {
            model: Product,
            listFields: ['id', 'name', 'price', 'active', 'label'],
            searchFields: ['name', 'sku'],
            fields: [
              {
                name: 'label',
                type: 'computed',
                computedGetter: (p) => `${p['name']} (${p['price']})`,
              },
            ],
            maxPageSize: 50,
          },
          new AdminResource({
            modelName: 'AdminTicket',
            exactCount: false,
            listFields: ['id', 'subject'],
          }),
        ],
        dashboard: [
          new MetricWidget({
            title: 'Products',
            cacheSeconds: 60,
            getValue: async () => {
              widgetCalls++;
              return { value: await Product.query().count(), change: 4 };
            },
          }),
          new MetricWidget({
            title: 'Secret revenue',
            permission: 'finance.view',
            getValue: () => 42,
          }),
          new ChartWidget({
            title: 'Prices',
            chartType: 'bar',
            getChartData: () => ({ labels: ['a', 'b'], datasets: [{ label: 'x', data: [1, 2] }] }),
          }),
        ],
        pages: [
          new AdminPage({
            id: 'sales',
            label: 'Sales',
            widgets: [new MetricWidget({ title: 'Orders today', getValue: () => 12 })],
          }),
        ],
        healthChecks: {
          cache: () => {
            throw new Error('connection refused');
          },
        },
      })
    );
    token = await h.login('root@example.com', 'a-long-admin-password');
  });
  afterAll(() => h.close());

  it('rejects anonymous requests, wrong passwords and the old built-in staff account', async () => {
    expect((await h.call('GET', '/resources')).status).toBe(401);
    expect(
      (await h.call('POST', '/auth/login', { body: { email: 'staff', password: 'staff123' } }))
        .status
    ).toBe(401);
    expect(
      (
        await h.call('POST', '/auth/login', {
          body: { email: 'root@example.com', password: 'admin123' },
        })
      ).status
    ).toBe(401);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it('locks a login out after repeated failures', async () => {
    for (let i = 0; i < 5; i++)
      await h.call('POST', '/auth/login', { body: { email: 'admin', password: 'nope' } });
    expect(
      (await h.call('POST', '/auth/login', { body: { email: 'admin', password: 'nope' } })).status
    ).toBe(429);
  });

  it('serves schemas inline, merging overrides with the model fields', async () => {
    const { data } = await h.call('GET', '/resources', { token });
    const product = data.resources.find((r: any) => r.id === 'adminproduct');
    expect(product.schema.listFields).toEqual(['id', 'name', 'price', 'active', 'label']);
    expect(product.schema.fields.map((f: any) => f.name)).toEqual(
      expect.arrayContaining(['sku', 'notes', 'label'])
    );
    expect(product.schema.filters.map((f: any) => f.field)).toContain('active');
    const ticket = data.resources.find((r: any) => r.id === 'adminticket');
    expect(ticket.schema.fields.map((f: any) => f.name)).toEqual(['id', 'subject']);
  });

  it('sorts, filters, searches and clamps page size safely', async () => {
    const page = (
      await h.call('GET', '/resources/adminproduct?sort=price&sortDirection=desc&pageSize=500', {
        token,
      })
    ).data;
    expect(page.pageSize).toBe(50);
    expect(page.items).toHaveLength(50);
    expect(page.items[0]).toEqual({
      id: ROWS,
      name: `Product ${ROWS - 1}`,
      price: ROWS - 1,
      active: false,
      label: `Product ${ROWS - 1} (${ROWS - 1})`,
    });
    expect(page.total).toBe(ROWS);

    // Unknown / injected sort columns are ignored (falls back to the primary key).
    const bad = (
      await h.call(
        'GET',
        `/resources/adminproduct?sort=${encodeURIComponent('price; DROP TABLE x')}`,
        { token }
      )
    ).data;
    expect(bad.items[0].id).toBe(1);

    const active = (
      await h.call(
        'GET',
        '/resources/adminproduct?filter_active=true&filter_notes=internal&pageSize=50',
        { token }
      )
    ).data;
    expect(active.total).toBe(ROWS / 2);
    expect(active.items.every((p: any) => p.active === true)).toBe(true);

    const search = (
      await h.call('GET', '/resources/adminproduct?search=SKU-0001&filter_active=false', { token })
    ).data;
    expect(search.items.map((p: any) => p.price).sort((a: number, b: number) => a - b)).toEqual([
      11, 13, 15, 17, 19,
    ]);
  });

  it('pages without COUNT(*) when exactCount is false', async () => {
    const first = (await h.call('GET', '/resources/adminticket?pageSize=25', { token })).data;
    expect(first.total).toBeNull();
    expect(first.hasMore).toBe(true);
    const second = (await h.call('GET', '/resources/adminticket?pageSize=25&page=2', { token }))
      .data;
    expect(second.items).toHaveLength(5);
    expect(second.hasMore).toBe(false);
  });

  it('streams every matching row as CSV through a one-time link', async () => {
    const { data } = await h.call('POST', '/resources/adminproduct/export', {
      token,
      body: { query: 'filter_active=true' },
    });
    const csv = await h.call('GET', data.url);
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    const lines = csv.text.trim().split('\r\n');
    expect(lines[0]).toBe('id,name,price,active,label');
    expect(lines).toHaveLength(ROWS / 2 + 1);
    expect(new Set(lines.slice(1).map((l) => l.split(',')[0])).size).toBe(ROWS / 2);

    const all = await h.call(
      'GET',
      (await h.call('POST', '/resources/adminproduct/export', { token, body: {} })).data.url
    );
    expect(all.text).toContain(`"'=HYPERLINK(""http://evil"")"`); // formula neutralized
    expect((await h.call('GET', data.url)).status).toBe(401); // single use
  });

  it('bulk-deletes in one request and caps the batch size', async () => {
    const res = await h.call('POST', '/resources/adminticket/bulk/delete', {
      token,
      body: { ids: [1, 2, 3, 999] },
    });
    expect(res.data.result).toEqual({ deleted: 3 });
    expect(await Ticket.query().count()).toBe(27);
    const tooMany = await h.call('POST', '/resources/adminticket/bulk/delete', {
      token,
      body: { ids: Array.from({ length: 1001 }, (_, i) => i) },
    });
    expect(tooMany.status).toBe(422);
  });

  it('serves dashboard widgets one by one with caching', async () => {
    const board = (await h.call('GET', '/dashboard', { token })).data;
    expect(board.widgets.map((w: any) => w.id)).toEqual(['products', 'secret-revenue', 'prices']);
    expect(board.widgets[2]).toMatchObject({ type: 'chart', chartType: 'bar' });
    const a = (await h.call('GET', '/dashboard/widgets/products', { token })).data;
    await h.call('GET', '/dashboard/widgets/products', { token });
    expect(a.data).toEqual({ value: ROWS, change: 4 });
    expect(widgetCalls).toBe(1);
    expect((await h.call('GET', '/dashboard/widgets/nope', { token })).status).toBe(404);
  });

  it('serves custom pages made of widgets', async () => {
    expect((await h.call('GET', '/pages', { token })).data.pages.map((p: any) => p.id)).toEqual([
      'sales',
    ]);
    const page = (await h.call('GET', '/pages/sales', { token })).data;
    expect(page.page.label).toBe('Sales');
    expect(
      (await h.call('GET', `/pages/sales/widgets/${page.widgets[0].id}`, { token })).data.data
    ).toBe(12);
  });

  it('reports real health checks', async () => {
    const { health } = (await h.call('GET', '/system/health', { token })).data;
    expect(health.services.database.status).toBe('up');
    expect(health.services.cache).toMatchObject({ status: 'down', subtext: 'connection refused' });
    expect(health.status).toBe('degraded');
  });

  it('records the audit trail', async () => {
    const audit = (await h.call('GET', '/audit?action=bulk_action', { token })).data;
    expect(audit.entries[0].metadata).toMatchObject({ actionId: 'delete', count: 3 });
    expect((await h.call('GET', '/audit?action=export', { token })).data.total).toBe(2);
  });

  it('lists real sessions and revokes them', async () => {
    const second = await h.login('root@example.com', 'a-long-admin-password');
    const sessions = (await h.call('GET', '/auth/sessions', { token })).data.sessions;
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.filter((s: any) => s.isCurrent)).toHaveLength(1);
    await h.call('POST', '/auth/sessions/terminate-others', { token });
    expect((await h.call('GET', '/resources', { token: second })).status).toBe(401);
    await h.call('POST', '/auth/logout', { token: second });
    expect((await h.call('GET', '/resources', { token })).status).toBe(200);
  });

  it('requires the current password to change it', async () => {
    expect(
      (
        await h.call('POST', '/auth/password', {
          token,
          body: { currentPassword: 'wrong', newPassword: 'another-long-password' },
        })
      ).status
    ).toBe(400);
    expect(
      (
        await h.call('POST', '/auth/password', {
          token,
          body: { currentPassword: 'a-long-admin-password', newPassword: 'short' },
        })
      ).status
    ).toBe(400);
  });
});

describe('admin panel login', () => {
  it('refuses the default password in production', async () => {
    const env = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    const h = await start((app) => app.admin({ resources: [] }));
    try {
      expect(
        (await h.call('POST', '/auth/login', { body: { email: 'admin', password: 'admin123' } }))
          .status
      ).toBe(503);
    } finally {
      process.env['NODE_ENV'] = env;
      await h.close();
    }
  });

  it('signs in with the application users (createAuth)', async () => {
    const users: Array<Record<string, unknown>> = [];
    const kit = createAuth({
      secret: 'x'.repeat(40),
      users: {
        findById: (id) => users.find((u) => String(u['id']) === String(id)) ?? null,
        findByLogin: (e) => users.find((u) => u['email'] === e) ?? null,
      },
    });
    const auth = kit;
    users.push(
      {
        id: 1,
        email: 'boss@example.com',
        role: 'admin',
        passwordHash: await auth.hashPassword('boss-password'),
      },
      {
        id: 2,
        email: 'staffer@example.com',
        role: 'staff',
        permissions: ['admin.adminproduct.view'],
        passwordHash: await auth.hashPassword('staff-password'),
      },
      {
        id: 3,
        email: 'user@example.com',
        role: 'member',
        passwordHash: await auth.hashPassword('user-password'),
      }
    );
    const h = await start((app) =>
      app.admin({
        auth: kit,
        resources: [Product],
        dashboard: [
          new MetricWidget({ title: 'Public', getValue: () => 1 }),
          new MetricWidget({ title: 'Finance', permission: 'finance.view', getValue: () => 2 }),
        ],
      })
    );
    try {
      expect(
        (
          await h.call('POST', '/auth/login', {
            body: { email: 'user@example.com', password: 'user-password' },
          })
        ).status
      ).toBe(403);
      expect(
        (
          await h.call('POST', '/auth/login', {
            body: { email: 'boss@example.com', password: 'wrong' },
          })
        ).status
      ).toBe(401);

      const boss = await h.login('boss@example.com', 'boss-password');
      expect((await h.call('GET', '/auth/me', { token: boss })).data.user.email).toBe(
        'boss@example.com'
      );
      expect(
        (
          await h.call('POST', '/auth/password', {
            token: boss,
            body: { currentPassword: 'boss-password', newPassword: 'x'.repeat(20) },
          })
        ).status
      ).toBe(400);

      const staffer = await h.login('staffer@example.com', 'staff-password');
      const widgets = (await h.call('GET', '/dashboard', { token: staffer })).data.widgets.map(
        (w: any) => w.id
      );
      expect(widgets).toEqual(['public']);
      expect((await h.call('GET', '/dashboard/widgets/finance', { token: staffer })).status).toBe(
        404
      );

      // Limited staff only get what their permissions grant (no more "default allow").
      expect((await h.call('GET', '/resources/adminproduct', { token: staffer })).status).toBe(200);
      expect(
        (
          await h.call('PATCH', '/resources/adminproduct/1', {
            token: staffer,
            body: { name: 'x' },
          })
        ).status
      ).toBe(403);

      // Banning / signing out the user everywhere ends their admin session (re-checked each minute).
      await auth.logoutAll(1);
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 61_000);
      expect((await h.call('GET', '/auth/me', { token: boss })).status).toBe(401);
    } finally {
      vi.useRealTimers();
      await h.close();
    }
  });
});

describe('ORM keyset batches', () => {
  it('chunk() visits every matching row once, keeping OR conditions grouped', async () => {
    const seen: number[] = [];
    await Product.query()
      .where('price', '<', 10)
      .orWhere('price', '>=', ROWS - 10)
      .chunk(3, (batch) => {
        seen.push(...batch.map((p: any) => p.getAttributes()['price'] as number));
      });
    expect(seen.sort((a, b) => a - b)).toEqual([
      ...Array.from({ length: 10 }, (_, i) => i),
      ...Array.from({ length: 10 }, (_, i) => ROWS - 10 + i),
    ]);
  });
});

describe('admin branding', () => {
  const config = (html: string) => JSON.parse(/__JSANGO_ADMIN_CONFIG__ = (.*);/.exec(html)![1]!);

  it('passes the logo to the UI and uses it as the favicon', () => {
    const html = renderAdminSpaHtml({
      title: 'Acme',
      logoUrl: '/static/logo.svg',
      logoText: 'ACME',
    });
    expect(config(html)).toMatchObject({ logoUrl: '/static/logo.svg', logoText: 'ACM' });
    expect(html).toContain('<link rel="icon" href="/static/logo.svg">');
  });

  it('drops unsafe logo URLs and cannot break out of the config script', () => {
    const html = renderAdminSpaHtml({
      title: '</script><script>alert(1)</script>',
      logoUrl: 'javascript:alert(1)',
    });
    expect(config(html).logoUrl).toBeUndefined();
    expect(html).not.toContain('</script><script>alert(1)');
    expect(config(html).title).toBe('</script><script>alert(1)</script>');
  });
});
