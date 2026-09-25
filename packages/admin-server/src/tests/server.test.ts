import { describe, it, expect, beforeEach } from 'vitest';
import { Router } from '@jsango/router';
import { HttpRequest, RequestContext } from '@jsango/http';
import { AdminRegistry, AdminResource } from '@jsango/admin-core';
import { AdminPermissionChecker } from '@jsango/admin-auth';
import { AdminAuditLogger, InMemoryAuditStore } from '@jsango/admin-audit';
import type { Identity } from '@jsango/auth';
import { AdminServer } from '../public/server.js';
import type { IAdminQueryAdapter, AdminListResult } from '../public/types.js';

describe('AdminServer', () => {
  let registry: AdminRegistry;
  let router: Router;
  let server: AdminServer;
  let db: Record<string, Record<string, unknown>>;
  let currentIdentity: Identity | undefined;

  const mockIdentity: Identity = {
    id: 'admin-1',
    type: 'user',
    isAuthenticated: true,
    isSuperuser: true,
    roles: ['admin'],
    permissions: ['admin.access', 'admin.*'],
    metadata: { username: 'superadmin', email: 'admin@example.com' },
    hasRole: () => true,
    hasPermission: () => true,
    toJSON: () => ({ id: 'admin-1' }),
  };

  beforeEach(() => {
    db = {
      '1': { id: '1', title: 'First Post', published: true },
      '2': { id: '2', title: 'Second Post', published: false },
    };

    currentIdentity = mockIdentity;

    const queryAdapter: IAdminQueryAdapter = {
      async list(): Promise<AdminListResult> {
        const items = Object.values(db);
        return { items, total: items.length, page: 1, pageSize: 25, totalPages: 1 };
      },
      async findById({ id }) {
        return db[String(id)] ?? null;
      },
      async create({ data }) {
        const id = String(Object.keys(db).length + 1);
        const item = { id, ...data };
        db[id] = item;
        return item;
      },
      async update({ id, data }) {
        const existing = db[String(id)];
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data };
        db[String(id)] = updated;
        return updated;
      },
      async delete({ id }) {
        delete db[String(id)];
      },
    };

    registry = new AdminRegistry();
    const resource = new AdminResource({
      id: 'posts',
      modelName: 'Post',
      label: 'Post',
      fields: [
        { name: 'id', type: 'uuid', readonly: true },
        { name: 'title', type: 'text', searchable: true },
        { name: 'published', type: 'boolean' },
      ],
      searchFields: ['title'],
      createFields: ['title', 'published'],
      editFields: ['title', 'published'],
    });
    registry.register(resource);

    const store = new InMemoryAuditStore();
    const audit = new AdminAuditLogger({ store });
    const permissions = new AdminPermissionChecker({ staffRole: 'admin' });

    server = new AdminServer({
      registry,
      queryAdapter,
      permissions,
      audit,
      prefix: '/admin/api/v1',
      resolveIdentity: () => currentIdentity,
    });

    router = new Router();
    server.mount(router);
    router.compile();
  });

  function createCtx(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): RequestContext {
    const req = new HttpRequest({
      method,
      url: `http://localhost${path}`,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'vitest-agent',
      },
      body: body !== undefined ? JSON.stringify(body) : null,
    });
    return new RequestContext({ request: req });
  }

  it('GET /resources returns list of registered resources', async () => {
    const ctx = createCtx('GET', '/admin/api/v1/resources');
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string) as { ok: boolean; data: { resources: unknown[] } };
    expect(data.ok).toBe(true);
    expect(data.data.resources).toHaveLength(1);
  });

  it('GET /resources/:resourceId/schema returns resource schema', async () => {
    const ctx = createCtx('GET', '/admin/api/v1/resources/posts/schema');
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string) as {
      ok: boolean;
      data: { schema: { id: string } };
    };
    expect(data.ok).toBe(true);
    expect(data.data.schema.id).toBe('posts');
  });

  it('GET /resources/:resourceId lists items', async () => {
    const ctx = createCtx('GET', '/admin/api/v1/resources/posts');
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string) as { ok: boolean; data: { total: number } };
    expect(data.ok).toBe(true);
    expect(data.data.total).toBe(2);
  });

  it('GET /resources/:resourceId/:id returns item detail', async () => {
    const ctx = createCtx('GET', '/admin/api/v1/resources/posts/1');
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string) as {
      ok: boolean;
      data: { item: { title: string } };
    };
    expect(data.ok).toBe(true);
    expect(data.data.item.title).toBe('First Post');
  });

  it('POST /resources/:resourceId creates item with 201 Created', async () => {
    const ctx = createCtx('POST', '/admin/api/v1/resources/posts', {
      title: 'Third Post',
      published: true,
    });
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body as string) as {
      ok: boolean;
      data: { item: { id: string; title: string } };
    };
    expect(data.ok).toBe(true);
    expect(data.data.item.title).toBe('Third Post');
    expect(db['3']).toBeDefined();
  });

  it('PATCH /resources/:resourceId/:id updates item', async () => {
    const ctx = createCtx('PATCH', '/admin/api/v1/resources/posts/1', { title: 'Updated Title' });
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string) as {
      ok: boolean;
      data: { item: { title: string } };
    };
    expect(data.ok).toBe(true);
    expect(data.data.item.title).toBe('Updated Title');
    expect(db['1']!['title']).toBe('Updated Title');
  });

  it('DELETE /resources/:resourceId/:id deletes item with 204 No Content', async () => {
    const ctx = createCtx('DELETE', '/admin/api/v1/resources/posts/1');
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(204);
    expect(db['1']).toBeUndefined();
  });

  it('returns 403 Forbidden for unauthorized user', async () => {
    currentIdentity = undefined; // Anonymous
    const ctx = createCtx('GET', '/admin/api/v1/resources');
    const res = await router.handle(ctx);

    expect(res.statusCode).toBe(403);
    const data = JSON.parse(res.body as string) as { ok: boolean; error: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('ERR_ADMIN_FORBIDDEN');
  });

  it('GET /audit queries audit log entries', async () => {
    // Generate an audit event first
    const createCtxReq = createCtx('POST', '/admin/api/v1/resources/posts', {
      title: 'Audited Post',
      published: true,
    });
    await router.handle(createCtxReq);

    const auditCtx = createCtx('GET', '/admin/api/v1/audit');
    const res = await router.handle(auditCtx);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string) as {
      ok: boolean;
      data: { total: number; entries: unknown[] };
    };
    expect(data.ok).toBe(true);
    expect(data.data.total).toBeGreaterThanOrEqual(1);
  });
});
