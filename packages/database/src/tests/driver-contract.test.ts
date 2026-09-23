import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryDatabaseDriver } from '../public/index.js';
import type { IDatabaseDriver } from '../public/index.js';

describe('Database Driver Contract Suite', () => {
  let driver: IDatabaseDriver;

  beforeEach(() => {
    driver = new MemoryDatabaseDriver();
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  it('should satisfy driver identity and capabilities', () => {
    expect(driver.name).toBe('memory');
    expect(driver.capabilities.supportsTransactions).toBe(true);
    expect(driver.capabilities.supportsSavepoints).toBe(true);
    expect(driver.capabilities.supportsIsolationLevels).toBe(true);
    expect(driver.capabilities.supportsCancellation).toBe(true);
    expect(driver.capabilities.placeholderType).toBe('question');
  });

  it('should connect and ping successfully', async () => {
    const conn = await driver.connect();
    expect(conn.isClosed).toBe(false);
    expect(await conn.ping()).toBe(true);

    await conn.close();
    expect(conn.isClosed).toBe(true);
    expect(await conn.ping()).toBe(false);
  });

  it('should execute basic queries with parameters', async () => {
    const conn = await driver.connect();
    try {
      const res = await conn.query('SELECT 1');
      expect(res.rowCount).toBe(1);
      expect(res.rows).toHaveLength(1);

      // Insert and query back
      const insert = await conn.query('INSERT INTO users (name, email) VALUES (?, ?)', [
        'Alice',
        'alice@example.com',
      ]);
      expect(insert.rowCount).toBe(1);
      expect(insert.lastInsertId).toBeDefined();

      const select = await conn.query('SELECT * FROM users WHERE name = ?', ['Alice']);
      expect(select.rowCount).toBe(1);
      expect((select.rows[0] as { name: string }).name).toBe('Alice');
    } finally {
      await conn.close();
    }
  });

  it('should support driver-level transactions and rollback', async () => {
    const conn = await driver.connect();
    try {
      await conn.query('BEGIN');
      await conn.query('INSERT INTO users (name) VALUES (?)', ['Bob']);

      const duringTx = await conn.query('SELECT * FROM users WHERE name = ?', ['Bob']);
      expect(duringTx.rowCount).toBe(1);

      await conn.query('ROLLBACK');

      const afterRollback = await conn.query('SELECT * FROM users WHERE name = ?', ['Bob']);
      expect(afterRollback.rowCount).toBe(0);
    } finally {
      await conn.close();
    }
  });

  it('should support savepoints within transactions', async () => {
    const conn = await driver.connect();
    try {
      await conn.query('BEGIN');
      await conn.query('INSERT INTO users (name) VALUES (?)', ['User1']);
      await conn.query('SAVEPOINT sp1');
      await conn.query('INSERT INTO users (name) VALUES (?)', ['User2']);

      const checkBoth = await conn.query('SELECT * FROM users WHERE name = ?', ['User2']);
      expect(checkBoth.rowCount).toBe(1);

      await conn.query('ROLLBACK TO SAVEPOINT sp1');

      const checkReverted = await conn.query('SELECT * FROM users WHERE name = ?', ['User2']);
      expect(checkReverted.rowCount).toBe(0);

      const checkPersisted = await conn.query('SELECT * FROM users WHERE name = ?', ['User1']);
      expect(checkPersisted.rowCount).toBe(1);

      await conn.query('COMMIT');
    } finally {
      await conn.close();
    }
  });
});
