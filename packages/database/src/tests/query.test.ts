import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager, ConnectionError, DatabaseError } from '../public/index.js';
import { SqlDialect } from '../internal/dialect.js';

interface UserRecord {
  id: number;
  name: string;
  email: string;
}

describe('Database Queries', () => {
  let db: DatabaseManager;

  beforeEach(() => {
    db = new DatabaseManager({
      default: 'default',
      connections: {
        default: { driver: 'memory' },
      },
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('should execute parameterized queries and return typed DatabaseResult', async () => {
    const conn = await db.connection();
    try {
      await conn.query('INSERT INTO users (name, email) VALUES (?, ?)', [
        'John Doe',
        'john@example.com',
      ]);

      const result = await conn.query<UserRecord>('SELECT * FROM users WHERE name = ?', [
        'John Doe',
      ]);

      expect(result.rowCount).toBe(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.name).toBe('John Doe');
      expect(result.rows[0]?.email).toBe('john@example.com');
      expect(result.fields).toBeDefined();
    } finally {
      await conn.release();
    }
  });

  it('should accurately normalize SQL placeholders according to dialect', () => {
    const questionDialect = new SqlDialect('question');
    expect(questionDialect.normalizePlaceholders('SELECT * FROM t WHERE a = ? AND b = ?')).toBe(
      'SELECT * FROM t WHERE a = ? AND b = ?'
    );

    const dollarDialect = new SqlDialect('dollar');
    expect(dollarDialect.normalizePlaceholders('SELECT * FROM t WHERE a = ? AND b = ?')).toBe(
      'SELECT * FROM t WHERE a = $1 AND b = $2'
    );

    // Ensure placeholders inside single-quoted strings are NOT replaced
    const withString = "SELECT * FROM t WHERE a = ? AND msg = 'what is this? really?' AND b = ?";
    expect(dollarDialect.normalizePlaceholders(withString)).toBe(
      "SELECT * FROM t WHERE a = $1 AND msg = 'what is this? really?' AND b = $2"
    );
  });

  it('should support AbortSignal cancellation on queries', async () => {
    const conn = await db.connection();
    const controller = new AbortController();
    controller.abort();

    try {
      await expect(conn.query('SELECT 1', [], { signal: controller.signal })).rejects.toThrow(
        DatabaseError
      );
    } finally {
      await conn.release();
    }
  });

  it('should invoke telemetry hooks if configured', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    const telemetryDb = new DatabaseManager(
      {
        default: 'default',
        connections: {
          default: { driver: 'memory' },
        },
      },
      {
        telemetry: {
          onQueryStart: onStart,
          onQueryEnd: onEnd,
          onQueryError: onError,
        },
      }
    );

    const conn = await telemetryDb.connection();
    try {
      await conn.query('SELECT 1');
      expect(onStart).toHaveBeenCalledWith('SELECT 1', []);
      expect(onEnd).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    } finally {
      await conn.release();
      await telemetryDb.close();
    }
  });

  it('should reject queries once connection has been released', async () => {
    const conn = await db.connection();
    await conn.release();

    expect(conn.isReleased).toBe(true);
    await expect(conn.query('SELECT 1')).rejects.toThrow(ConnectionError);
  });
});
