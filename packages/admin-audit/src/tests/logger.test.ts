import { describe, it, expect, beforeEach } from 'vitest';
import { AdminAuditLogger } from '../public/logger.js';
import { InMemoryAuditStore } from '../public/store.js';

describe('AdminAuditLogger', () => {
  let store: InMemoryAuditStore;
  let logger: AdminAuditLogger;

  beforeEach(() => {
    store = new InMemoryAuditStore();
    logger = new AdminAuditLogger({ store });
  });

  it('appends an entry to the store', async () => {
    await logger.log('create', {
      resourceId: 'user',
      objectId: '1',
      objectRepresentation: 'alice',
    });

    const page = await logger.query({ resourceId: 'user' });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]!.action).toBe('create');
    expect(page.entries[0]!.objectId).toBe('1');
  });

  it('assigns a unique ID and timestamp to every entry', async () => {
    await logger.log('update', { resourceId: 'post', objectId: '42' });
    await logger.log('update', { resourceId: 'post', objectId: '42' });

    const page = await logger.query({ resourceId: 'post' });
    const ids = page.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    for (const entry of page.entries) {
      expect(entry.timestamp).toBeInstanceOf(Date);
    }
  });

  it('returns entries sorted newest-first', async () => {
    await logger.log('create', { resourceId: 'r', objectId: '1' });
    await logger.log('update', { resourceId: 'r', objectId: '1' });

    const page = await logger.query({ resourceId: 'r' });
    expect(page.entries[0]!.action).toBe('update');
    expect(page.entries[1]!.action).toBe('create');
  });

  it('paginates correctly', async () => {
    for (let i = 0; i < 10; i++) {
      await logger.log('view' as never, { resourceId: 'x', objectId: String(i) });
    }

    const page = await logger.query({ limit: 3, offset: 0 });
    expect(page.entries).toHaveLength(3);
    expect(page.total).toBe(10);
    expect(page.limit).toBe(3);
  });

  describe('diffChanges', () => {
    it('detects changed fields', () => {
      const changes = logger.diffChanges({ name: 'Alice', age: 30 }, { name: 'Bob', age: 30 });
      expect(changes).toHaveLength(1);
      expect(changes[0]!.field).toBe('name');
      expect(changes[0]!.before).toBe('Alice');
      expect(changes[0]!.after).toBe('Bob');
    });

    it('redacts sensitive fields by default', () => {
      const changes = logger.diffChanges(
        { password: 'old', email: 'a@a.com' },
        { password: 'new', email: 'b@b.com' }
      );
      const fields = changes.map((c) => c.field);
      expect(fields).not.toContain('password');
      expect(fields).toContain('email');
    });

    it('respects visibleFields filter', () => {
      const changes = logger.diffChanges(
        { name: 'A', role: 'user' },
        { name: 'B', role: 'admin' },
        ['name'] // only diff name
      );
      expect(changes).toHaveLength(1);
      expect(changes[0]!.field).toBe('name');
    });

    it('does not include unchanged fields', () => {
      const changes = logger.diffChanges({ x: 1, y: 2 }, { x: 1, y: 2 });
      expect(changes).toHaveLength(0);
    });
  });

  describe('InMemoryAuditStore', () => {
    it('returns undefined for a non-existent ID', async () => {
      const entry = await store.findById('does-not-exist');
      expect(entry).toBeUndefined();
    });

    it('finds by ID after appending', async () => {
      await logger.log('delete', { resourceId: 'z', objectId: '99' });
      const page = await logger.query({ resourceId: 'z' });
      const id = page.entries[0]!.id;
      const found = await logger.findById(id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(id);
    });

    it('filters by action', async () => {
      await logger.log('create', { resourceId: 'r2' });
      await logger.log('delete', { resourceId: 'r2' });

      const page = await logger.query({ resourceId: 'r2', action: 'create' });
      expect(page.entries).toHaveLength(1);
      expect(page.entries[0]!.action).toBe('create');
    });

    it('filters by date range', async () => {
      const before = new Date(Date.now() - 10000);
      await logger.log('create', { resourceId: 'dated' });
      const after = new Date(Date.now() + 10000);

      const inRange = await logger.query({ resourceId: 'dated', fromDate: before, toDate: after });
      expect(inRange.entries).toHaveLength(1);

      const outOfRange = await logger.query({ resourceId: 'dated', toDate: before });
      expect(outOfRange.entries).toHaveLength(0);
    });
  });
});
