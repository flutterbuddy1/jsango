import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import {
  PostgresDatabaseDriver,
  PostgresDriverConnection,
  MysqlDatabaseDriver,
  MysqlDriverConnection,
  SqliteDatabaseDriver,
  SqliteDriverConnection,
  MongoDatabaseDriver,
  DatabaseManager,
  ConnectionError,
  DatabaseConfigurationError,
} from '../public/index.js';

const tmpDirs: string[] = [];
function tmpFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsango-db-'));
  tmpDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Database Drivers Suite', () => {
  describe('PostgreSQL Driver', () => {
    it('runs real queries through an injected pg-compatible module', async () => {
      const pg = newDb().adapters.createPg();
      const driver = new PostgresDatabaseDriver({ host: 'localhost', database: 'testdb' }, { pg });
      expect(driver.name).toBe('postgres');
      expect(driver.capabilities.placeholderType).toBe('dollar');
      expect(driver.capabilities.supportsReturning).toBe(true);

      const conn = await driver.connect();
      expect(conn).toBeInstanceOf(PostgresDriverConnection);

      await conn.query('CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, meta JSONB)');
      const inserted = await conn.query<{ id: number }>(
        'INSERT INTO items (name, meta) VALUES ($1, $2) RETURNING id',
        ['Keyboard', { tags: ['usb', 'mech'] }]
      );
      expect(inserted.rows[0]?.id).toBe(1);

      const res = await conn.query<{ name: string; meta: { tags: string[] } }>(
        'SELECT name, meta FROM items WHERE id = $1',
        [1]
      );
      expect(res.rows[0]?.name).toBe('Keyboard');
      expect(res.rows[0]?.meta.tags).toEqual(['usb', 'mech']);
      expect(await conn.ping()).toBe(true);

      await conn.close();
      expect(conn.isClosed).toBe(true);
      await expect(conn.query('SELECT 1')).rejects.toThrow(/closed Postgres connection/);
      await driver.disconnect();
    });

    it('reports an actionable error when the server is unreachable', async () => {
      const driver = new PostgresDatabaseDriver({
        host: '127.0.0.1',
        port: 1,
        database: 'app',
        username: 'app',
        password: 'secret',
      });
      const err = await driver.connect().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConnectionError);
      const message = (err as Error).message;
      expect(message).toContain('app@127.0.0.1:1/app');
      expect(message).toMatch(/ECONNREFUSED/);
      expect(message).toMatch(/Hint: .*running/);
      expect(message).not.toContain('secret');
    });
  });

  describe('MySQL Driver', () => {
    function fakeMysql(log: { sql: string; params: unknown[] }[]) {
      const connection = {
        released: false,
        async query(sql: string, params: unknown[]) {
          log.push({ sql, params });
          if (/^SELECT/i.test(sql)) {
            return [[{ num: 42 }], [{ name: 'num', type: 3 }]];
          }
          return [{ affectedRows: 1, insertId: 7 }, undefined];
        },
        release() {
          this.released = true;
        },
      };
      return {
        connection,
        module: {
          createPool: (settings: Record<string, unknown>) => ({
            settings,
            getConnection: async () => connection,
            end: async () => undefined,
          }),
        },
      };
    }

    it('maps SELECT rows and INSERT headers, serializing JSON/undefined params', async () => {
      const log: { sql: string; params: unknown[] }[] = [];
      const fake = fakeMysql(log);
      const driver = new MysqlDatabaseDriver(
        { host: 'localhost', port: 3306, database: 'testdb' },
        { mysql: fake.module }
      );
      expect(driver.name).toBe('mysql');
      expect(driver.capabilities.supportsReturning).toBe(false);

      const conn = await driver.connect();
      expect(conn).toBeInstanceOf(MysqlDriverConnection);

      const sel = await conn.query('SELECT ? AS num', [42]);
      expect(sel.rows).toEqual([{ num: 42 }]);
      expect(sel.rowCount).toBe(1);

      const ins = await conn.query('INSERT INTO t (a, b, c) VALUES (?, ?, ?)', [
        { x: 1 },
        undefined,
        [1, 2],
      ]);
      expect(ins.rowCount).toBe(1);
      expect(ins.lastInsertId).toBe(7);
      expect(log[1]?.params).toEqual(['{"x":1}', null, '[1,2]']);

      await conn.close();
      expect(fake.connection.released).toBe(true);
      await expect(conn.query('SELECT 1')).rejects.toThrow(/closed MySQL connection/);
    });

    it('reports an actionable error when the server is unreachable', async () => {
      const driver = new MysqlDatabaseDriver({ host: '127.0.0.1', port: 1, database: 'app' });
      const err = await driver.connect().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConnectionError);
      expect((err as Error).message).toMatch(/Failed to connect to MySQL at 127\.0\.0\.1:1\/app/);
      expect((err as Error).message).toMatch(/Hint:/);
      await driver.disconnect();
    });
  });

  describe.each(['better-sqlite3', 'node:sqlite'] as const)('SQLite Driver (%s)', (engine) => {
    it('executes DDL, DML, RETURNING and converts JS values', async () => {
      const driver = new SqliteDatabaseDriver({ filename: ':memory:' }, { engine });
      expect(driver.name).toBe('sqlite');
      expect(driver.maxConnections).toBe(1);

      const conn = (await driver.connect()) as SqliteDriverConnection;
      expect(conn.engine).toBe(engine);

      await conn.query(
        'CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, active INTEGER, created DATETIME, meta TEXT)'
      );
      const created = new Date('2026-01-02T03:04:05.000Z');
      const ins = await conn.query('INSERT INTO items (name, active, created, meta) VALUES (?, ?, ?, ?)', [
        'Keyboard',
        true,
        created,
        { a: 1 },
      ]);
      expect(ins.rowCount).toBe(1);
      expect(ins.lastInsertId).toBe(1);

      const ret = await conn.query<{ id: number; name: string }>(
        'INSERT INTO items (name, active) VALUES (?, ?) RETURNING id, name',
        ['Mouse', false]
      );
      expect(ret.rows).toEqual([{ id: 2, name: 'Mouse' }]);

      const res = await conn.query<Record<string, unknown>>('SELECT * FROM items ORDER BY id');
      expect(res.rows).toHaveLength(2);
      expect(res.rows[0]).toMatchObject({
        name: 'Keyboard',
        active: 1,
        created: created.toISOString(),
        meta: '{"a":1}',
      });

      const upd = await conn.query('UPDATE items SET name = ? WHERE id = ?', ['Trackpad', 2]);
      expect(upd.rowCount).toBe(1);

      await expect(conn.query('SELECT * FROM missing')).rejects.toThrow(/SQLite query failed/);

      await conn.close();
      expect(conn.isClosed).toBe(true);
    });

    it('creates the parent directory of a file database and enables foreign keys', async () => {
      const file = path.join(tmpFile('x'), '..', 'nested', 'app.sqlite3');
      const driver = new SqliteDatabaseDriver({ filename: file }, { engine });
      const conn = await driver.connect();
      const fk = await conn.query<Record<string, unknown>>('PRAGMA foreign_keys');
      expect(Object.values(fk.rows[0]!)[0]).toBe(1);
      await conn.close();
      expect(fs.existsSync(file)).toBe(true);
    });
  });

  describe('MongoDB Driver', () => {
    it('reports an actionable error when the server is unreachable', async () => {
      const driver = new MongoDatabaseDriver({
        host: '127.0.0.1',
        port: 1,
        database: 'test',
        pool: { connectionTimeoutMs: 300 },
      });
      expect(driver.name).toBe('mongodb');
      await expect(driver.connect()).rejects.toThrow(/Failed to connect to MongoDB at 127\.0\.0\.1:1\/test/);
    });

    it('explains how to install the client package when it is missing', async () => {
      const driver = new MongoDatabaseDriver({ url: 'mongodb://localhost:27017' }, { mongodb: {} });
      await expect(driver.connect()).rejects.toThrow(/does not export MongoClient/);
    });
  });

  describe('DatabaseManager with multiple drivers', () => {
    it('keeps one shared in-memory SQLite database across pooled connections', async () => {
      const manager = new DatabaseManager({
        default: 'main',
        connections: { main: { driver: 'sqlite', filename: ':memory:' } },
      });

      await manager.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)');
      await manager.query('INSERT INTO users (email) VALUES (?)', ['a@example.com']);
      const [a, b] = await Promise.all([
        manager.query('SELECT COUNT(*) AS n FROM users'),
        manager.query('SELECT email FROM users'),
      ]);
      expect(a.rows[0]).toEqual({ n: 1 });
      expect(b.rows[0]).toEqual({ email: 'a@example.com' });
      await manager.close();
    });

    it('infers the driver from url and resolves the "default" alias', async () => {
      const file = tmpFile('app.db');
      const manager = new DatabaseManager({
        default: 'primary',
        connections: { primary: { url: `sqlite:${file}` } },
      });
      expect(manager.getDriverName()).toBe('sqlite');
      expect(manager.resolveConnectionName('default')).toBe('primary');
      expect(manager.getDialect('default').quoteIdentifier('users')).toBe('"users"');
      await manager.verify('default');
      await manager.close();
    });

    it('uses backtick quoting for MySQL and dollar placeholders for Postgres', () => {
      const manager = new DatabaseManager({
        default: 'my',
        connections: {
          my: { url: 'mysql://root@localhost/app' },
          pg: { url: 'postgresql://app@localhost/app' },
        },
      });
      expect(manager.getDialect('my').quoteIdentifier('users')).toBe('`users`');
      expect(manager.getDialect('pg').normalizePlaceholders('a = ? AND b = ?')).toBe('a = $1 AND b = $2');
      expect(manager.getDialect('pg').supportsReturning).toBe(true);
      expect(manager.getDialect('my').supportsReturning).toBe(false);
    });

    it('rejects unusable configuration with a clear message', () => {
      expect(() => new DatabaseManager({ default: 'x', connections: { x: { driver: '' } } })).toThrow(
        DatabaseConfigurationError
      );
      expect(
        () => new DatabaseManager({ default: 'missing', connections: { a: { driver: 'memory' } } })
      ).toThrow(/Default database connection "missing" is not defined/);

      const manager = new DatabaseManager({ default: 'a', connections: { a: { driver: 'oracle' } } });
      expect(() => manager.getDialect()).toThrow(/Unknown database driver "oracle"/);
    });
  });
});
