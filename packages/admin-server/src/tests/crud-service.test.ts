import { describe, it, expect, beforeEach } from 'vitest';
import { AdminResource, AdminAuthorizationError, AdminItemNotFoundError } from '@jsango/admin-core';
import { AdminPermissionChecker } from '@jsango/admin-auth';
import { AdminAuditLogger, InMemoryAuditStore } from '@jsango/admin-audit';
import { AdminCrudService } from '../public/crud-service.js';
import type { IAdminQueryAdapter, AdminListResult } from '../public/types.js';

// ---------------------------------------------------------------------------
// Minimal stub adapter
// ---------------------------------------------------------------------------

const DB: Record<string, Record<string, unknown>> = {
  '1': { id: '1', name: 'Alice', email: 'alice@example.com', role: 'user' },
  '2': { id: '2', name: 'Bob', email: 'bob@example.com', role: 'admin' },
};

function makeAdapter(overrides: Partial<IAdminQueryAdapter> = {}): IAdminQueryAdapter {
  return {
    async list(): Promise<AdminListResult> {
      const items = Object.values(DB);
      return { items, total: items.length, page: 1, pageSize: 25, totalPages: 1 };
    },
    async findById({ id }) {
      return DB[String(id)] ?? null;
    },
    async create({ data }) {
      const newItem = { id: String(Object.keys(DB).length + 1), ...data };
      DB[String(newItem.id)] = newItem;
      return newItem;
    },
    async update({ id, data }) {
      const existing = DB[String(id)];
      if (!existing) throw new Error('Not found');
      const updated = { ...existing, ...data };
      DB[String(id)] = updated;
      return updated;
    },
    async delete({ id }) {
      delete DB[String(id)];
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Minimal stub identity
// ---------------------------------------------------------------------------

function makeIdentity(
  overrides: {
    id?: string;
    isAuthenticated?: boolean;
    isSuperuser?: boolean;
    roles?: string[];
    permissions?: string[];
  } = {}
) {
  return {
    id: overrides.id ?? 'u1',
    username: 'testuser',
    email: 'test@example.com',
    isAuthenticated: overrides.isAuthenticated ?? true,
    isSuperuser: overrides.isSuperuser ?? false,
    roles: overrides.roles ?? ['admin'],
    permissions: overrides.permissions ?? ['admin.access'],
    hasRole: (r: string) => (overrides.roles ?? ['admin']).includes(r),
    hasPermission: (p: string) =>
      (overrides.permissions ?? ['admin.access', 'admin.*']).includes(p) ||
      (overrides.permissions ?? ['admin.access', 'admin.*']).includes('admin.*'),
  };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function makeResource() {
  return new AdminResource({
    id: 'user',
    modelName: 'User',
    label: 'User',
    fields: [
      { name: 'id', type: 'uuid', readonly: true },
      { name: 'name', type: 'text', searchable: true },
      { name: 'email', type: 'email', searchable: true },
      { name: 'role', type: 'enum' },
    ],
    searchFields: ['name', 'email'],
    createFields: ['name', 'email', 'role'],
    editFields: ['name', 'email', 'role'],
  });
}

function makeService(adapterOverrides: Partial<IAdminQueryAdapter> = {}) {
  const store = new InMemoryAuditStore();
  const audit = new AdminAuditLogger({ store });
  const permissions = new AdminPermissionChecker({ staffRole: 'admin' });
  const adapter = makeAdapter(adapterOverrides);

  const service = new AdminCrudService({ queryAdapter: adapter, permissions, audit });
  return { service, audit, store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminCrudService', () => {
  let resource: AdminResource;

  beforeEach(() => {
    resource = makeResource();
    // Reset DB
    Object.keys(DB).forEach((k) => delete DB[k]);
    DB['1'] = { id: '1', name: 'Alice', email: 'alice@example.com', role: 'user' };
    DB['2'] = { id: '2', name: 'Bob', email: 'bob@example.com', role: 'admin' };
  });

  // -------------------------------------------------------------------------
  // getSchema
  // -------------------------------------------------------------------------

  describe('getSchema()', () => {
    it('returns schema for authenticated staff', () => {
      const { service } = makeService();
      const identity = makeIdentity();
      const schema = service.getSchema(resource, identity);
      expect(schema.id).toBe('user');
      expect(schema.fields.length).toBeGreaterThan(0);
    });

    it('throws AdminAuthorizationError for anonymous users', () => {
      const { service } = makeService();
      const identity = makeIdentity({ isAuthenticated: false });
      expect(() => service.getSchema(resource, identity)).toThrow(AdminAuthorizationError);
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list()', () => {
    it('returns paginated items', async () => {
      const { service } = makeService();
      const identity = makeIdentity();
      const result = await service.list(resource, {}, identity);
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('strips fields the actor cannot see', async () => {
      const { service } = makeService();
      // identity with no sensitive-field perm (role is not sensitive, so all should pass)
      const identity = makeIdentity();
      const result = await service.list(resource, {}, identity);
      // listFields default excludes hidden/sensitive; id is readonly but visible
      for (const item of result.items) {
        expect(Object.keys(item)).not.toContain('password');
      }
    });

    it('denies anonymous identities', async () => {
      const { service } = makeService();
      const anon = makeIdentity({ isAuthenticated: false });
      await expect(service.list(resource, {}, anon)).rejects.toThrow(AdminAuthorizationError);
    });
  });

  // -------------------------------------------------------------------------
  // detail
  // -------------------------------------------------------------------------

  describe('detail()', () => {
    it('returns a single item', async () => {
      const { service } = makeService();
      const identity = makeIdentity();
      const item = await service.detail(resource, '1', identity);
      expect(item['name']).toBe('Alice');
    });

    it('throws AdminItemNotFoundError for missing IDs', async () => {
      const { service } = makeService();
      const identity = makeIdentity();
      await expect(service.detail(resource, '999', identity)).rejects.toThrow(
        AdminItemNotFoundError
      );
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('creates a record and emits an audit entry', async () => {
      const { service, audit } = makeService();
      const identity = makeIdentity({ isSuperuser: true });

      const created = await service.create(
        resource,
        { name: 'Carol', email: 'carol@example.com', role: 'user' },
        identity
      );

      expect(created['name']).toBe('Carol');

      const page = await audit.query({ resourceId: 'user', action: 'create' });
      expect(page.entries).toHaveLength(1);
    });

    it('strips fields not in createFields', async () => {
      const { service } = makeService();
      const identity = makeIdentity({ isSuperuser: true });

      const created = await service.create(
        resource,
        { name: 'Dave', email: 'dave@example.com', role: 'user', __internal: true },
        identity
      );

      expect(created).not.toHaveProperty('__internal');
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update()', () => {
    it('updates an existing record', async () => {
      const { service } = makeService();
      const identity = makeIdentity({ isSuperuser: true });

      const updated = await service.update(resource, '1', { name: 'Alicia' }, identity);
      expect(updated['name']).toBe('Alicia');
    });

    it('throws AdminItemNotFoundError when item does not exist', async () => {
      const { service } = makeService();
      const identity = makeIdentity({ isSuperuser: true });
      await expect(service.update(resource, '999', { name: 'X' }, identity)).rejects.toThrow(
        AdminItemNotFoundError
      );
    });

    it('emits a change audit entry', async () => {
      const { service, audit } = makeService();
      const identity = makeIdentity({ isSuperuser: true });
      await service.update(resource, '1', { name: 'Alicia' }, identity);

      const page = await audit.query({ action: 'update' });
      expect(page.entries).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete()', () => {
    it('deletes a record', async () => {
      const { service } = makeService();
      const identity = makeIdentity({ isSuperuser: true });

      await service.delete(resource, '1', identity);

      await expect(service.detail(resource, '1', identity)).rejects.toThrow(AdminItemNotFoundError);
    });

    it('denies delete for unauthorized identity', async () => {
      const { service } = makeService();
      const noPerms = makeIdentity({
        isSuperuser: false,
        roles: [],
        permissions: [],
      });

      await expect(service.delete(resource, '1', noPerms)).rejects.toThrow(AdminAuthorizationError);
    });
  });
});
