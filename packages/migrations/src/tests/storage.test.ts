import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationStorage } from '../internal/storage.js';
import { Migration } from '../public/migration.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('MigrationStorage', () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
  });

  it('should create tracking table and record migrations', async () => {
    const conn = await db.manager.connection('default');
    try {
      await MigrationStorage.ensureTable(conn);

      const empty = await MigrationStorage.getAppliedMigrations(conn);
      expect(empty).toEqual([]);
      expect(await MigrationStorage.getMaxBatch(conn)).toBe(0);

      const m1 = new Migration({
        id: '20260924100000_init',
        name: 'init',
        up: async () => {},
      });

      await MigrationStorage.recordMigration(conn, m1, 1, 'abc123');

      const applied = await MigrationStorage.getAppliedMigrations(conn);
      expect(applied.length).toBe(1);
      expect(applied[0]!.id).toBe('20260924100000_init');
      expect(applied[0]!.batch).toBe(1);
      expect(applied[0]!.checksum).toBe('abc123');
      expect(await MigrationStorage.getMaxBatch(conn)).toBe(1);

      await MigrationStorage.removeMigration(conn, '20260924100000_init');
      const cleared = await MigrationStorage.getAppliedMigrations(conn);
      expect(cleared.length).toBe(0);
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  });
});
