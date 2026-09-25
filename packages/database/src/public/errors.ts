import { JsangoError } from '@jsango/core';

export interface DatabaseErrorOptions {
  readonly message: string;
  readonly code?: string | undefined;
  readonly statusCode?: number | undefined;
  readonly cause?: unknown | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export class DatabaseError extends JsangoError {
  constructor(options: DatabaseErrorOptions) {
    super({
      code: options.code ?? 'ERR_DATABASE',
      message: options.message,
      statusCode: options.statusCode ?? 500,
      cause: options.cause,
      metadata: options.metadata,
    });
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, cause?: unknown, metadata?: Record<string, unknown>) {
    super({
      code: 'ERR_DB_CONNECTION',
      message,
      statusCode: 503,
      cause,
      metadata,
    });
  }
}

export class ConnectionAcquisitionTimeoutError extends DatabaseError {
  constructor(timeoutMs: number, connectionName = 'default') {
    super({
      code: 'ERR_DB_POOL_TIMEOUT',
      message: `Timed out acquiring database connection "${connectionName}" after ${timeoutMs}ms.`,
      statusCode: 504,
      metadata: { timeoutMs, connectionName },
    });
  }
}

export class PoolExhaustedError extends DatabaseError {
  constructor(maxSize: number, connectionName = 'default') {
    super({
      code: 'ERR_DB_POOL_EXHAUSTED',
      message: `Database connection pool "${connectionName}" is exhausted (max capacity: ${maxSize}).`,
      statusCode: 503,
      metadata: { maxSize, connectionName },
    });
  }
}

export class QueryError extends DatabaseError {
  public readonly sql: string;

  constructor(message: string, sql: string, cause?: unknown, metadata?: Record<string, unknown>) {
    super({
      code: 'ERR_DB_QUERY',
      message,
      statusCode: 500,
      cause,
      metadata: { ...metadata, sql },
    });
    this.sql = sql;
  }
}

export class TransactionError extends DatabaseError {
  constructor(message: string, cause?: unknown, metadata?: Record<string, unknown>) {
    super({
      code: 'ERR_DB_TRANSACTION',
      message,
      statusCode: 500,
      cause,
      metadata,
    });
  }
}

export class TransactionClosedError extends TransactionError {
  constructor(action: string, state: 'committed' | 'rolledBack') {
    super(`Cannot ${action} on transaction because it has already been ${state}.`, undefined, {
      action,
      state,
    });
  }
}

export class IsolationLevelUnsupportedError extends DatabaseError {
  constructor(level: string, driverName: string) {
    super({
      code: 'ERR_DB_ISOLATION_UNSUPPORTED',
      message: `Transaction isolation level "${level}" is not supported by driver "${driverName}".`,
      statusCode: 400,
      metadata: { level, driverName },
    });
  }
}

export class DatabaseConfigurationError extends DatabaseError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super({
      code: 'ERR_DB_CONFIG',
      message,
      statusCode: 500,
      metadata,
    });
  }
}
