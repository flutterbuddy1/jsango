import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationRunner } from '../public/runner.js';
import { Migration } from '../public/migration.js';
import { MigrationRegistry } from '../public/registry.js';
import { CreateTableOperation, DropTableOperation } from '../public/operations.js';
import { DestructiveMigrationError } from '../public/errors.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('MigrationRunner', () => {
  let db: ReturnType<typeof createTestDatabase>;
  let registry: MigrationRegistry;
  let runner: MigrationRunner;

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
    registry = new MigrationRegistry();
    runner = new MigrationRunner({
      databaseManager: db.manager,
      registry,
    });
  });

  it('should report status when no migrations are applied', async () => {
    registry.register(
      new Migration({
        id: '20260924100000_create_users',
        name: 'create_users',
        operations: [
          new CreateTableOperation({
            name: 'users',
            columns: [{ name: 'id', type: 'integer', primaryKey: true }],
          }),
        ],
      })
    );

    const status = await runner.status();
    expect(status.applied.length).toBe(0);
    expect(status.pending.length).toBe(1);
    expect(status.isUpToDate).toBe(false);
    expect(status.currentVersion).toBeNull();
  });

  it('should execute pending migrations and update status', async () => {
    registry.register(
      new Migration({
        id: '20260924100000_create_users',
        name: 'create_users',
        operations: [
          new CreateTableOperation({
            name: 'users',
            columns: [{ name: 'id', type: 'integer', primaryKey: true }],
          }),
        ],
      })
    );

    const res = await runner.migrate();
    expect(res.applied).toEqual(['20260924100000_create_users']);
    expect(res.batch).toBe(1);

    const status = await runner.status();
    expect(status.applied.length).toBe(1);
    expect(status.pending.length).toBe(0);
    expect(status.isUpToDate).toBe(true);
    expect(status.currentVersion).toBe('20260924100000_create_users');
    expect(status.latestBatch).toBe(1);

    // Verify table created in database
    expect(db.driver.getTableNames()).toContain('users');
  });

  it('should be idempotent when no pending migrations exist', async () => {
    registry.register(
      new Migration({
        id: '20260924100000_create_users',
        name: 'create_users',
        operations: [
          new CreateTableOperation({
            name: 'users',
            columns: [{ name: 'id', type: 'integer', primaryKey: true }],
          }),
        ],
      })
    );

    await runner.migrate();
    const secondRun = await runner.migrate();

    expect(secondRun.applied).toEqual([]);
    expect(secondRun.batch).toBe(1);
  });

  it('should reject destructive migrations unless allowDestructive is true', async () => {
    registry.register(
      new Migration({
        id: '20260924100000_create_users',
        name: 'create_users',
        operations: [
          new CreateTableOperation({
            name: 'users',
            columns: [{ name: 'id', type: 'integer', primaryKey: true }],
          }),
        ],
      })
    );

    await runner.migrate();
    expect(db.driver.getTableNames()).toContain('users');

    registry.register(
      new Migration({
        id: '20260924100001_drop_users',
        name: 'drop_users',
        operations: [new DropTableOperation('users')],
      })
    );

    // The second migration is destructive (drop table)
    await expect(runner.migrate()).rejects.toThrow(DestructiveMigrationError);

    // Now pass allowDestructive: true
    const res = await runner.migrate({ allowDestructive: true });
    expect(res.applied).toEqual(['20260924100001_drop_users']);
    expect(db.driver.getTableNames()).not.toContain('users');
  });
});
