import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationRunner } from '../public/runner.js';
import { Migration } from '../public/migration.js';
import { MigrationRegistry } from '../public/registry.js';
import { CreateTableOperation, AddColumnOperation } from '../public/operations.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('MigrationRunner Rollback', () => {
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

  it('should rollback the latest batch in reverse chronological order', async () => {
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
    registry.register(
      new Migration({
        id: '20260924100001_add_email',
        name: 'add_email',
        operations: [new AddColumnOperation('users', { name: 'email', type: 'string' })],
      })
    );

    // Apply batch 1
    await runner.migrate();

    const statusAfterMigrate = await runner.status();
    expect(statusAfterMigrate.applied.length).toBe(2);

    // Rollback batch 1
    const rollbackRes = await runner.rollback({ allowDestructive: true });
    expect(rollbackRes.rolledBack).toEqual([
      '20260924100001_add_email',
      '20260924100000_create_users',
    ]);

    const statusAfterRollback = await runner.status();
    expect(statusAfterRollback.applied.length).toBe(0);
    expect(statusAfterRollback.pending.length).toBe(2);
    expect(statusAfterRollback.isUpToDate).toBe(false);
  });

  it('should support rollback by specific steps', async () => {
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
    await runner.migrate(); // batch 1

    registry.register(
      new Migration({
        id: '20260924100001_add_email',
        name: 'add_email',
        operations: [new AddColumnOperation('users', { name: 'email', type: 'string' })],
      })
    );
    await runner.migrate(); // batch 2

    // Rollback 1 step (only migration 2)
    const res = await runner.rollback({ steps: 1, allowDestructive: true });
    expect(res.rolledBack).toEqual(['20260924100001_add_email']);

    const status = await runner.status();
    expect(status.applied.length).toBe(1);
    expect(status.applied[0]!.id).toBe('20260924100000_create_users');
  });

  it('should reset database with explicit confirmation', async () => {
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

    // Reset without confirmation fails
    await expect(runner.reset({ confirm: 'wrong' as 'YES_I_AM_SURE' })).rejects.toThrow(
      /confirmation 'YES_I_AM_SURE' is required/
    );

    // Reset with confirmation succeeds
    const resetRes = await runner.reset({ confirm: 'YES_I_AM_SURE' });
    expect(resetRes.rolledBack).toEqual(['20260924100000_create_users']);

    const status = await runner.status();
    expect(status.applied.length).toBe(0);
  });
});
