import { describe, it, expect } from 'vitest';
import {
  DatabaseManager,
  DatabaseConnection,
  DatabaseTransaction,
  MemoryDatabaseDriver,
  type IDatabaseDriver,
} from './index.js';

describe('@django-js/database', () => {
  it('should export all public database abstractions and classes', () => {
    expect(DatabaseManager).toBeDefined();
    expect(DatabaseConnection).toBeDefined();
    expect(DatabaseTransaction).toBeDefined();
    expect(MemoryDatabaseDriver).toBeDefined();
  });

  it('should support typing mock database driver via interfaces', async () => {
    class MockDriver implements IDatabaseDriver {
      readonly name = 'mock';
      readonly capabilities = {
        supportsTransactions: true,
        supportsSavepoints: false,
        supportsIsolationLevels: false,
        supportsReturning: false,
        supportsCancellation: false,
        placeholderType: 'question' as const,
      };
      async connect() {
        return {
          isClosed: false,
          query: async <T = Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }),
          ping: async () => true,
          close: async () => {},
        };
      }
      async disconnect() {}
    }

    const driver = new MockDriver();
    const conn = await driver.connect();
    const res = await conn.query('SELECT 1');
    expect(res.rowCount).toBe(0);
    expect(res.rows).toEqual([]);
  });

  it('should perform complete end-to-end database lifecycle with DatabaseManager', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: {
        default: {
          driver: 'memory',
          pool: { min: 1, max: 2 },
        },
      },
    });

    // 1. Parameterized query
    const insertRes = await db.query('INSERT INTO products (name, price) VALUES (?, ?)', [
      'Laptop',
      999,
    ]);
    expect(insertRes.rowCount).toBe(1);

    // 2. Query
    const selectRes = await db.query('SELECT * FROM products WHERE name = ?', ['Laptop']);
    expect(selectRes.rowCount).toBe(1);

    // 3. Transaction
    const txVal = await db.transaction(async (tx) => {
      await tx.query('INSERT INTO products (name, price) VALUES (?, ?)', ['Phone', 499]);
      return 'created';
    });
    expect(txVal).toBe('created');

    // 4. Health
    const health = await db.health();
    expect(health[0]?.status).toBe('healthy');

    // 5. Shutdown
    await db.close();
  });
});
