import { describe, it, expect } from 'vitest';
import { ConnectionPool } from '../internal/pool.js';
import { MemoryDatabaseDriver } from '../public/index.js';
import { ConnectionAcquisitionTimeoutError, DatabaseError } from '../public/errors.js';

describe('ConnectionPool', () => {
  it('should initialize and warm up to minimum connections', async () => {
    const driver = new MemoryDatabaseDriver();
    const pool = new ConnectionPool(() => driver.connect(), {
      min: 3,
      max: 5,
    });

    await pool.initialize();
    expect(pool.size).toBe(3);
    expect(pool.idleCount).toBe(3);
    expect(pool.activeCount).toBe(0);

    await pool.close();
  });

  it('should allocate connections up to max capacity on demand', async () => {
    const driver = new MemoryDatabaseDriver();
    const pool = new ConnectionPool(() => driver.connect(), {
      min: 1,
      max: 3,
    });

    const c1 = await pool.acquire();
    const c2 = await pool.acquire();
    const c3 = await pool.acquire();

    expect(pool.size).toBe(3);
    expect(pool.activeCount).toBe(3);
    expect(pool.idleCount).toBe(0);

    await pool.release(c1);
    await pool.release(c2);
    await pool.release(c3);

    expect(pool.activeCount).toBe(0);
    expect(pool.idleCount).toBe(3);

    await pool.close();
  });

  it('should queue waiters when max capacity is reached and resolve on release', async () => {
    const driver = new MemoryDatabaseDriver();
    const pool = new ConnectionPool(() => driver.connect(), {
      min: 1,
      max: 1,
      acquireTimeoutMs: 1000,
    });

    const c1 = await pool.acquire();
    expect(pool.activeCount).toBe(1);

    let acquiredQueued = false;
    const queuedPromise = pool.acquire().then((c) => {
      acquiredQueued = true;
      return c;
    });

    expect(pool.pendingCount).toBe(1);
    expect(acquiredQueued).toBe(false);

    // Release c1, which should immediately satisfy the waiter
    await pool.release(c1);
    const cQueued = await queuedPromise;

    expect(acquiredQueued).toBe(true);
    expect(cQueued).toBe(c1);
    expect(pool.activeCount).toBe(1);

    await pool.release(cQueued);
    await pool.close();
  });

  it('should timeout pending waiters when acquireTimeoutMs expires', async () => {
    const driver = new MemoryDatabaseDriver();
    const pool = new ConnectionPool(() => driver.connect(), {
      min: 1,
      max: 1,
      acquireTimeoutMs: 50,
    });

    const c1 = await pool.acquire();

    await expect(pool.acquire({ timeoutMs: 50 })).rejects.toThrow(
      ConnectionAcquisitionTimeoutError
    );

    await pool.release(c1);
    await pool.close();
  });

  it('should support cancellation via AbortSignal', async () => {
    const driver = new MemoryDatabaseDriver();
    const pool = new ConnectionPool(() => driver.connect(), {
      min: 1,
      max: 1,
    });

    const c1 = await pool.acquire();
    const controller = new AbortController();

    const acquirePromise = pool.acquire({ signal: controller.signal });
    controller.abort();

    await expect(acquirePromise).rejects.toThrow(DatabaseError);

    await pool.release(c1);
    await pool.close();
  });

  it('should replace destroyed connections for pending waiters', async () => {
    const driver = new MemoryDatabaseDriver();
    const pool = new ConnectionPool(() => driver.connect(), {
      min: 1,
      max: 1,
    });

    const c1 = await pool.acquire();
    const queuedPromise = pool.acquire();

    // Destroy c1 instead of releasing it
    await pool.destroy(c1);

    const cReplacement = await queuedPromise;
    expect(cReplacement).toBeDefined();
    expect(cReplacement).not.toBe(c1);

    await pool.release(cReplacement);
    await pool.close();
  });

  it('should close pool gracefully, reject waiters and destroy connections', async () => {
    const driver = new MemoryDatabaseDriver();
    const pool = new ConnectionPool(() => driver.connect(), {
      min: 2,
      max: 2,
    });

    await pool.initialize();
    await pool.acquire();
    await pool.acquire();

    const queuedPromise = pool.acquire();

    await pool.close();

    expect(pool.isClosed).toBe(true);
    await expect(queuedPromise).rejects.toThrow(DatabaseError);
    await expect(pool.acquire()).rejects.toThrow(DatabaseError);
  });

  it('never opens more than max connections under a burst of concurrent acquires', async () => {
    const driver = new MemoryDatabaseDriver();
    let opened = 0;
    const pool = new ConnectionPool(
      async () => {
        opened++;
        await new Promise((r) => setTimeout(r, 10)); // slow connect, like a real database
        return driver.connect();
      },
      { min: 0, max: 2, acquireTimeoutMs: 1000 }
    );
    const conns = Promise.all(Array.from({ length: 5 }, () => pool.acquire()));
    await new Promise((r) => setTimeout(r, 30));
    expect(opened).toBe(2);
    expect(pool.size).toBe(2);
    // The waiters are served as connections come back.
    const first = await Promise.race([conns, new Promise((r) => setTimeout(r, 0, 'pending'))]);
    expect(first).toBe('pending');
    await pool.close();
    await conns.catch(() => {});
  });
});
