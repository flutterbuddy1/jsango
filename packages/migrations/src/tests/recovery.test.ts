import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationRunner } from '../public/runner.js';
import { Migration } from '../public/migration.js';
import { MigrationRegistry } from '../public/registry.js';
import { CreateTableOperation } from '../public/operations.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('Migration Failure Recovery & Isolation', () => {
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

  it('should isolate failure, keep previous migrations applied, and restart cleanly after fix', async () => {
    // Migration 1: valid
    registry.register(
      new Migration({
        id: '20260924100000_valid_users',
        name: 'valid_users',
        operations: [
          new CreateTableOperation({
            name: 'users',
            columns: [{ name: 'id', type: 'integer', primaryKey: true }],
          }),
        ],
      })
    );

    let shouldFail = true;

    // Migration 2: fails initially
    registry.register(
      new Migration({
        id: '20260924100001_failing_migration',
        name: 'failing_migration',
        up: async () => {
          if (shouldFail) {
            throw new Error('Simulated DDL syntax failure');
          }
        },
      })
    );

    // Migration 3: subsequent migration
    registry.register(
      new Migration({
        id: '20260924100002_posts',
        name: 'posts',
        operations: [
          new CreateTableOperation({
            name: 'posts',
            columns: [{ name: 'id', type: 'integer', primaryKey: true }],
          }),
        ],
      })
    );

    // Run migrate: Migration 1 succeeds, Migration 2 throws error
    await expect(runner.migrate()).rejects.toThrow('Simulated DDL syntax failure');

    // Check status: Migration 1 is recorded as applied; 2 and 3 are pending
    const status1 = await runner.status();
    expect(status1.applied.length).toBe(1);
    expect(status1.applied[0]!.id).toBe('20260924100000_valid_users');
    expect(status1.pending.length).toBe(2);
    expect(status1.pending.map((m) => m.id)).toEqual([
      '20260924100001_failing_migration',
      '20260924100002_posts',
    ]);

    // Now fix Migration 2
    shouldFail = false;

    // Run migrate again: restartability succeeds
    const res2 = await runner.migrate();
    expect(res2.applied).toEqual(['20260924100001_failing_migration', '20260924100002_posts']);

    const status2 = await runner.status();
    expect(status2.applied.length).toBe(3);
    expect(status2.pending.length).toBe(0);
    expect(status2.isUpToDate).toBe(true);
  });
});
