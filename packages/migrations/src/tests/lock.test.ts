import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationLock } from '../public/lock.js';
import { MigrationLockedError } from '../public/errors.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('MigrationLock', () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
  });

  it('should acquire and release lock cleanly', async () => {
    const conn = await db.manager.connection('default');
    try {
      const lock = new MigrationLock(conn, { acquireTimeoutMs: 500, retryIntervalMs: 50 });

      expect(lock.isLocked).toBe(false);
      await lock.acquire();
      expect(lock.isLocked).toBe(true);

      await lock.release();
      expect(lock.isLocked).toBe(false);
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  });

  it('should block competing locks and time out', async () => {
    const conn1 = await db.manager.connection('default');
    const conn2 = await db.manager.connection('default');
    try {
      const lock1 = new MigrationLock(conn1, {
        ownerId: 'owner_1',
        acquireTimeoutMs: 500,
        retryIntervalMs: 50,
      });
      const lock2 = new MigrationLock(conn2, {
        ownerId: 'owner_2',
        acquireTimeoutMs: 200,
        retryIntervalMs: 50,
      });

      await lock1.acquire();

      // lock2 should fail with MigrationLockedError
      await expect(lock2.acquire()).rejects.toThrow(MigrationLockedError);

      await lock1.release();

      // Now lock2 can acquire
      await lock2.acquire();
      expect(lock2.isLocked).toBe(true);
      await lock2.release();
    } finally {
      if ('release' in conn1 && typeof conn1.release === 'function') {
        await conn1.release();
      }
      if ('release' in conn2 && typeof conn2.release === 'function') {
        await conn2.release();
      }
    }
  });

  it('should recover stale lock after expiry', async () => {
    const conn = await db.manager.connection('default');
    try {
      const lock1 = new MigrationLock(conn, {
        ownerId: 'crashed_process',
        lockExpiryMs: 100, // short expiry
      });
      await lock1.acquire();

      // Simulate abandoned lock without release
      await new Promise((r) => setTimeout(r, 150));

      const lock2 = new MigrationLock(conn, {
        ownerId: 'new_process',
        acquireTimeoutMs: 500,
        retryIntervalMs: 50,
        lockExpiryMs: 100,
      });

      // lock2 should successfully take over the stale lock
      await lock2.acquire();
      expect(lock2.isLocked).toBe(true);
      await lock2.release();
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  });
});
