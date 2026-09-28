import { describe, it, expect } from 'vitest';
import {
  PostgresDatabaseDriver,
  PostgresDriverConnection,
  MysqlDatabaseDriver,
  MysqlDriverConnection,
  SqliteDatabaseDriver,
  SqliteDriverConnection,
  MongoDatabaseDriver,
  MongoDriverConnection,
  DatabaseManager,
} from '../public/index.js';

describe('Database Drivers Suite', () => {
  describe('PostgreSQL Driver', () => {
    it('creates driver instance and connects in mock/fallback mode without crash', async () => {
      const driver = new PostgresDatabaseDriver({ host: 'localhost', port: 5432, database: 'testdb' });
      expect(driver.name).toBe('postgres');
      expect(driver.capabilities.placeholderType).toBe('dollar');
      expect(driver.capabilities.supportsReturning).toBe(true);

      const conn = await driver.connect();
      expect(conn).toBeInstanceOf(PostgresDriverConnection);
      expect(conn.isClosed).toBe(false);

      const res = await conn.query('SELECT $1::int as num', [42]);
      expect(res.rows).toEqual([]);
      expect(res.rowCount).toBe(0);

      const ping = await conn.ping();
      expect(ping).toBe(true);

      await conn.close();
      expect(conn.isClosed).toBe(true);

      await expect(conn.query('SELECT 1')).rejects.toThrow(/closed Postgres connection/);
      await driver.disconnect();
    });
  });

  describe('MySQL Driver', () => {
    it('creates driver instance and connects in mock/fallback mode', async () => {
      const driver = new MysqlDatabaseDriver({ host: 'localhost', port: 3306, database: 'testdb' });
      expect(driver.name).toBe('mysql');
      expect(driver.capabilities.placeholderType).toBe('question');
      expect(driver.capabilities.supportsReturning).toBe(false);

      const conn = await driver.connect();
      expect(conn).toBeInstanceOf(MysqlDriverConnection);
      expect(conn.isClosed).toBe(false);

      const res = await conn.query('SELECT ? as num', [42]);
      expect(res.rows).toEqual([]);
      expect(res.rowCount).toBe(0);

      await conn.close();
      expect(conn.isClosed).toBe(true);

      await expect(conn.query('SELECT 1')).rejects.toThrow(/closed MySQL connection/);
      await driver.disconnect();
    });
  });

  describe('SQLite Driver', () => {
    it('creates driver instance and supports queries via in-memory SQL fallback', async () => {
      const driver = new SqliteDatabaseDriver({ filename: ':memory:' });
      expect(driver.name).toBe('sqlite');
      expect(driver.capabilities.placeholderType).toBe('question');

      const conn = await driver.connect();
      expect(conn).toBeInstanceOf(SqliteDriverConnection);
      expect(conn.isClosed).toBe(false);

      await conn.query('CREATE TABLE items (id INTEGER, name TEXT)');
      await conn.query("INSERT INTO items VALUES (1, 'Keyboard')");
      const res = await conn.query('SELECT * FROM items');
      expect(res.rows.length).toBe(1);
      expect((res.rows[0] as any).name).toBe('Keyboard');

      await conn.close();
      expect(conn.isClosed).toBe(true);
      await driver.disconnect();
    });
  });

  describe('MongoDB Driver', () => {
    it('creates driver instance and handles queries', async () => {
      const driver = new MongoDatabaseDriver({ url: 'mongodb://localhost:27017', database: 'test' });
      expect(driver.name).toBe('mongodb');
      expect(driver.capabilities.placeholderType).toBe('named');

      const conn = await driver.connect();
      expect(conn).toBeInstanceOf(MongoDriverConnection);
      expect(conn.isClosed).toBe(false);

      const res = await conn.query(JSON.stringify({ collection: 'users', action: 'find' }));
      expect(res.rows).toEqual([]);

      await conn.close();
      expect(conn.isClosed).toBe(true);

      await expect(conn.query(JSON.stringify({ collection: 'users' }))).rejects.toThrow(/closed MongoDB connection/);
      await driver.disconnect();
    });
  });

  describe('DatabaseManager with Multi-Driver Registration', () => {
    it('resolves connections across different driver configurations', async () => {
      const manager = new DatabaseManager({
        default: 'sqlite',
        connections: {
          sqlite: { driver: 'sqlite', database: ':memory:' },
          pg: { driver: 'postgres', host: 'localhost', port: 5432, database: 'app' },
          mysql: { driver: 'mysql', host: 'localhost', port: 3306, database: 'app' },
          mongo: { driver: 'mongodb', url: 'mongodb://localhost:27017', database: 'app' },
        },
      });

      const sqliteConn = await manager.connection('sqlite');
      expect(sqliteConn).toBeDefined();
      await sqliteConn.query('CREATE TABLE users (id INT, email TEXT)');
      await sqliteConn.release();

      const pgConn = await manager.connection('pg');
      expect(pgConn).toBeDefined();
      await pgConn.release();

      const mysqlConn = await manager.connection('mysql');
      expect(mysqlConn).toBeDefined();
      await mysqlConn.release();

      const mongoConn = await manager.connection('mongo');
      expect(mongoConn).toBeDefined();
      await mongoConn.release();

      await manager.close();
    });
  });
});
