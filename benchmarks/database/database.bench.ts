import { bench, describe } from 'vitest';
import {
  DatabaseManager,
  maskConnectionString,
  maskConnectionConfig,
  MemoryDatabaseDriver,
} from '../../packages/database/src/public/index.js';
import { SqlDialect } from '../../packages/database/src/internal/dialect.js';
import { ConnectionPool } from '../../packages/database/src/internal/pool.js';

describe('Database Abstraction Benchmarks', async () => {
  const driver = new MemoryDatabaseDriver();
  const pool = new ConnectionPool(() => driver.connect(), {
    min: 10,
    max: 20,
  });
  await pool.initialize();

  const db = new DatabaseManager({
    default: 'default',
    connections: {
      default: {
        driver: 'memory',
        pool: { min: 10, max: 20 },
      },
    },
  });

  const sharedConn = await db.connection();
  const dialect = new SqlDialect('dollar');

  // 1. Connection acquisition from pool
  bench('1. Connection acquisition from pool', async () => {
    const conn = await pool.acquire();
    await pool.release(conn);
  });

  // 2. Connection release back to pool
  bench('2. Connection release back to pool', async () => {
    const conn = await pool.acquire();
    await pool.release(conn);
  });

  // 3. Parameterized query execution
  bench('3. Parameterized query execution on active connection', async () => {
    await sharedConn.query('SELECT * FROM users WHERE id = ?', [1]);
  });

  // 4. Transaction creation and commit
  bench('4. Transaction creation and commit', async () => {
    const tx = await sharedConn.beginTransaction();
    await tx.query('SELECT 1');
    await tx.commit();
  });

  // 5. Transaction creation and rollback
  bench('5. Transaction creation and rollback', async () => {
    const tx = await sharedConn.beginTransaction();
    await tx.query('SELECT 1');
    await tx.rollback();
  });

  // 6. SQL Dialect placeholder normalization (? to $1)
  bench('6. Dialect placeholder normalization', () => {
    dialect.normalizePlaceholders('SELECT * FROM users WHERE id = ? AND status = ? AND age > ?');
  });

  // 7. Full DatabaseManager query dispatch (acquire -> query -> release)
  bench('7. Full DatabaseManager query dispatch (acquire -> query -> release)', async () => {
    await db.query('SELECT 1');
  });

  // 8. Credential masking in connection strings
  bench('8. Credential masking in connection strings', () => {
    maskConnectionString('postgres://admin:superSecretPass@cluster.internal:5432/db');
    maskConnectionConfig({
      driver: 'postgres',
      password: 'secretPassword',
      url: 'postgres://admin:superSecretPass@cluster.internal:5432/db',
    });
  });

  // 9. Savepoint creation and release within transaction
  bench('9. Savepoint creation and rollback', async () => {
    const tx = await sharedConn.beginTransaction();
    await tx.savepoint('sp1');
    await tx.rollbackTo('sp1');
    await tx.commit();
  });
});
