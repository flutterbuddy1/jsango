import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DatabaseManager,
  IsolationLevelUnsupportedError,
  TransactionClosedError,
} from '../public/index.js';

describe('Database Transactions', () => {
  let db: DatabaseManager;

  beforeEach(() => {
    db = new DatabaseManager({
      default: 'default',
      connections: {
        default: {
          driver: 'memory',
        },
      },
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('should commit transaction and persist modifications', async () => {
    const conn = await db.connection();
    try {
      const tx = await conn.beginTransaction();
      expect(tx.isCompleted).toBe(false);

      await tx.query('INSERT INTO items (name) VALUES (?)', ['Widget']);
      await tx.commit();

      expect(tx.isCompleted).toBe(true);

      const check = await conn.query('SELECT * FROM items WHERE name = ?', ['Widget']);
      expect(check.rowCount).toBe(1);
    } finally {
      await conn.release();
    }
  });

  it('should rollback transaction and revert modifications', async () => {
    const conn = await db.connection();
    try {
      const tx = await conn.beginTransaction();
      await tx.query('INSERT INTO items (name) VALUES (?)', ['Temporary']);
      await tx.rollback();

      expect(tx.isCompleted).toBe(true);

      const check = await conn.query('SELECT * FROM items WHERE name = ?', ['Temporary']);
      expect(check.rowCount).toBe(0);
    } finally {
      await conn.release();
    }
  });

  it('should auto-commit when transaction callback completes normally', async () => {
    const conn = await db.connection();
    try {
      const result = await conn.transaction(async (tx) => {
        await tx.query('INSERT INTO items (name) VALUES (?)', ['AutoCommitted']);
        return 'success';
      });

      expect(result).toBe('success');

      const check = await conn.query('SELECT * FROM items WHERE name = ?', ['AutoCommitted']);
      expect(check.rowCount).toBe(1);
    } finally {
      await conn.release();
    }
  });

  it('should auto-rollback and rethrow when transaction callback throws', async () => {
    const conn = await db.connection();
    try {
      const errorToThrow = new Error('Database failure during tx');

      await expect(
        conn.transaction(async (tx) => {
          await tx.query('INSERT INTO items (name) VALUES (?)', ['ShouldBeRolledBack']);
          throw errorToThrow;
        })
      ).rejects.toThrow('Database failure during tx');

      const check = await conn.query('SELECT * FROM items WHERE name = ?', ['ShouldBeRolledBack']);
      expect(check.rowCount).toBe(0);
    } finally {
      await conn.release();
    }
  });

  it('should enforce state machine guards against double completion', async () => {
    const conn = await db.connection();
    try {
      const tx = await conn.beginTransaction();
      await tx.commit();

      await expect(tx.commit()).rejects.toThrow(TransactionClosedError);
      await expect(tx.rollback()).rejects.toThrow(TransactionClosedError);
      await expect(tx.query('SELECT 1')).rejects.toThrow(TransactionClosedError);
      await expect(tx.savepoint('sp1')).rejects.toThrow(TransactionClosedError);
    } finally {
      await conn.release();
    }
  });

  it('should support savepoints within transactions', async () => {
    const conn = await db.connection();
    try {
      const tx = await conn.beginTransaction();

      await tx.query('INSERT INTO items (name) VALUES (?)', ['First']);
      await tx.savepoint('sp_after_first');

      await tx.query('INSERT INTO items (name) VALUES (?)', ['Second']);
      await tx.rollbackTo('sp_after_first');

      await tx.commit();

      const checkFirst = await conn.query('SELECT * FROM items WHERE name = ?', ['First']);
      expect(checkFirst.rowCount).toBe(1);

      const checkSecond = await conn.query('SELECT * FROM items WHERE name = ?', ['Second']);
      expect(checkSecond.rowCount).toBe(0);
    } finally {
      await conn.release();
    }
  });

  it('should throw IsolationLevelUnsupportedError when driver does not support isolation level', async () => {
    // Register mock driver that does not support isolation levels
    const mockDriver = {
      name: 'no_isolation',
      capabilities: {
        supportsTransactions: true,
        supportsSavepoints: false,
        supportsIsolationLevels: false,
        supportsReturning: false,
        supportsCancellation: false,
        placeholderType: 'question' as const,
      },
      connect: async () => ({
        isClosed: false,
        query: async () => ({ rows: [], rowCount: 0 }),
        ping: async () => true,
        close: async () => {},
      }),
      disconnect: async () => {},
    };

    const isolatedDb = new DatabaseManager({
      default: 'unsupported',
      connections: {
        unsupported: { driver: 'no_isolation' },
      },
    });
    isolatedDb.registerDriver('no_isolation', mockDriver);

    const conn = await isolatedDb.connection();
    try {
      await expect(conn.beginTransaction({ isolationLevel: 'SERIALIZABLE' })).rejects.toThrow(
        IsolationLevelUnsupportedError
      );
    } finally {
      await conn.release();
      await isolatedDb.close();
    }
  });

  it('should automatically rollback active transaction when connection is released', async () => {
    const conn = await db.connection();
    const tx = await conn.beginTransaction();
    await tx.query('INSERT INTO items (name) VALUES (?)', ['Orphaned']);

    // Release without committing
    await conn.release();
    expect(conn.isReleased).toBe(true);

    const newConn = await db.connection();
    try {
      const check = await newConn.query('SELECT * FROM items WHERE name = ?', ['Orphaned']);
      expect(check.rowCount).toBe(0);
    } finally {
      await newConn.release();
    }
  });
});
