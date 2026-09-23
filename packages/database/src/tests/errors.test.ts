import { describe, it, expect } from 'vitest';
import {
  DatabaseError,
  ConnectionError,
  ConnectionAcquisitionTimeoutError,
  PoolExhaustedError,
  QueryError,
  TransactionClosedError,
  IsolationLevelUnsupportedError,
  maskConnectionString,
  maskConnectionConfig,
  parseConnectionUrl,
} from '../public/index.js';

describe('Database Errors and Credential Masking', () => {
  it('should mask passwords in connection strings', () => {
    const url = 'postgres://admin:secretPassword123@db.internal.net:5432/production_db';
    const masked = maskConnectionString(url);

    expect(masked).not.toContain('secretPassword123');
    expect(masked).toContain('********');
    expect(masked).toContain('admin');
    expect(masked).toContain('production_db');
  });

  it('should sanitize connection config objects', () => {
    const config = {
      driver: 'postgres',
      username: 'dbuser',
      password: 'superSecretPassword!',
      url: 'postgres://dbuser:superSecretPassword!@localhost:5432/mydb',
    };

    const masked = maskConnectionConfig(config);
    expect(masked.password).toBe('********');
    expect(masked.url).not.toContain('superSecretPassword!');
    expect(masked.url).toContain('********');
  });

  it('should parse database connection URLs', () => {
    const url = 'postgresql://myuser:mypass@127.0.0.1:5433/custom_db';
    const parsed = parseConnectionUrl(url);

    expect(parsed.driver).toBe('postgresql');
    expect(parsed.username).toBe('myuser');
    expect(parsed.password).toBe('mypass');
    expect(parsed.host).toBe('127.0.0.1');
    expect(parsed.port).toBe(5433);
    expect(parsed.database).toBe('custom_db');
  });

  it('should preserve error codes, status codes, and causes in error hierarchy', () => {
    const original = new Error('Socket closed unexpectedly');
    const connErr = new ConnectionError('Failed to connect to host', original);

    expect(connErr).toBeInstanceOf(DatabaseError);
    expect(connErr.code).toBe('ERR_DB_CONNECTION');
    expect(connErr.statusCode).toBe(503);
    expect(connErr.cause).toBe(original);

    const timeoutErr = new ConnectionAcquisitionTimeoutError(5000, 'primary');
    expect(timeoutErr.code).toBe('ERR_DB_POOL_TIMEOUT');
    expect(timeoutErr.statusCode).toBe(504);

    const poolErr = new PoolExhaustedError(10, 'primary');
    expect(poolErr.code).toBe('ERR_DB_POOL_EXHAUSTED');
    expect(poolErr.statusCode).toBe(503);

    const queryErr = new QueryError('Syntax error', 'SELECT * FORM t');
    expect(queryErr.code).toBe('ERR_DB_QUERY');
    expect(queryErr.sql).toBe('SELECT * FORM t');

    const txClosed = new TransactionClosedError('commit', 'rolledBack');
    expect(txClosed.code).toBe('ERR_DB_TRANSACTION');

    const isoErr = new IsolationLevelUnsupportedError('SNAPSHOT', 'sqlite');
    expect(isoErr.code).toBe('ERR_DB_ISOLATION_UNSUPPORTED');
    expect(isoErr.statusCode).toBe(400);
  });
});
