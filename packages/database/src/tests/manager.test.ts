import { describe, it, expect } from 'vitest';
import { DatabaseManager, DatabaseConfigurationError, DatabaseError } from '../public/index.js';

describe('DatabaseManager', () => {
  it('should support multiple named database connections', async () => {
    const db = new DatabaseManager({
      default: 'primary',
      connections: {
        primary: { driver: 'memory' },
        analytics: { driver: 'memory' },
      },
    });

    const primaryConn = await db.connection('primary');
    const analyticsConn = await db.connection('analytics');

    await primaryConn.query('INSERT INTO logs (level) VALUES (?)', ['info']);
    const checkPrimary = await primaryConn.query('SELECT * FROM logs WHERE level = ?', ['info']);
    expect(checkPrimary.rowCount).toBe(1);

    await primaryConn.release();
    await analyticsConn.release();
    await db.close();
  });

  it('should execute queries and transactions via top-level convenience methods', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: {
        default: { driver: 'memory' },
      },
    });

    // Top-level query
    const res = await db.query('SELECT 1');
    expect(res.rowCount).toBe(1);

    // Top-level transaction
    const txResult = await db.transaction(async (tx) => {
      await tx.query('INSERT INTO events (title) VALUES (?)', ['Launch']);
      return 'done';
    });
    expect(txResult).toBe('done');

    const verify = await db.query('SELECT * FROM events WHERE title = ?', ['Launch']);
    expect(verify.rowCount).toBe(1);

    await db.close();
  });

  it('should perform health checks across connections', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: {
        default: { driver: 'memory' },
      },
    });

    const health = await db.health();
    expect(health).toHaveLength(1);
    expect(health[0]?.status).toBe('healthy');
    expect(health[0]?.connectionName).toBe('default');
    expect(health[0]?.latencyMs).toBeGreaterThanOrEqual(0);

    await db.close();
  });

  it('should throw DatabaseConfigurationError for unconfigured connection names', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: {
        default: { driver: 'memory' },
      },
    });

    await expect(db.connection('missing_conn')).rejects.toThrow(DatabaseConfigurationError);

    await db.close();
  });

  it('should close all pools and disallow new connections after close', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: {
        default: { driver: 'memory' },
      },
    });

    const conn = await db.connection();
    await conn.release();

    await db.close();

    await expect(db.connection()).rejects.toThrow(DatabaseError);
  });
});
