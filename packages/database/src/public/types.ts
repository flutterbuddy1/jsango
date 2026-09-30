import type { SqlDialect } from './dialect.js';
import type { PoolConfig } from './config.js';

export interface FieldMetadata {
  readonly name: string;
  readonly type?: string | undefined;
}

export interface DatabaseResult<T = Record<string, unknown>> {
  readonly rows: readonly T[];
  readonly rowCount: number;
  readonly lastInsertId?: number | string | bigint | undefined;
  readonly fields?: readonly FieldMetadata[] | undefined;
}

/** Backward-compatible alias for DatabaseResult */
export type QueryResult<T = Record<string, unknown>> = DatabaseResult<T>;

export interface QueryOptions {
  readonly timeoutMs?: number | undefined;
  readonly signal?: AbortSignal | undefined;
}

export type IsolationLevel =
  'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

export interface TransactionOptions {
  readonly isolationLevel?: IsolationLevel | undefined;
  readonly readOnly?: boolean | undefined;
  readonly timeoutMs?: number | undefined;
}

export interface DatabaseCapabilities {
  readonly supportsTransactions: boolean;
  readonly supportsSavepoints: boolean;
  readonly supportsIsolationLevels: boolean;
  readonly supportsReturning: boolean;
  readonly supportsCancellation: boolean;
  readonly placeholderType: 'dollar' | 'question' | 'named';
  readonly supportsTransactionalDDL?: boolean | undefined;
  readonly supportedIsolationLevels?: readonly IsolationLevel[] | undefined;
}

export interface IDriverConnection {
  readonly isClosed: boolean;
  /** Structured document commands (MongoDB only). */
  execute?<T = Record<string, unknown>>(command: MongoCommand): Promise<DatabaseResult<T>>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface IDatabaseDriver {
  readonly name: string;
  readonly capabilities: DatabaseCapabilities;
  /**
   * Pool settings the driver recommends (e.g. a single connection for in-memory SQLite).
   * Explicit `pool` settings in the connection config take precedence.
   */
  readonly poolDefaults?: PoolConfig | undefined;
  /** Hard upper bound on pooled connections that user config cannot exceed. */
  readonly maxConnections?: number | undefined;
  connect(): Promise<IDriverConnection>;
  disconnect(): Promise<void>;
}

export interface IDatabaseTransaction {
  readonly id: string;
  readonly isCompleted: boolean;
  /** SQL dialect of the underlying connection (quoting, placeholders, RETURNING support). */
  readonly dialect?: SqlDialect | undefined;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>>;
  /** Structured document commands (MongoDB only). */
  execute?<T = Record<string, unknown>>(command: MongoCommand): Promise<DatabaseResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  savepoint(name: string): Promise<void>;
  rollbackTo(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
}

export type ITransaction = IDatabaseTransaction;

export interface IDatabaseConnection {
  readonly isReleased: boolean;
  /** SQL dialect of the connection (quoting, placeholders, RETURNING support). */
  readonly dialect?: SqlDialect | undefined;
  /** Name of the driver serving this connection (e.g. 'postgres', 'mysql', 'sqlite'). */
  readonly driverName?: string | undefined;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>>;
  /** Structured document commands (MongoDB only). */
  execute?<T = Record<string, unknown>>(command: MongoCommand): Promise<DatabaseResult<T>>;
  beginTransaction(options?: TransactionOptions): Promise<IDatabaseTransaction>;
  transaction<T>(
    callback: (tx: IDatabaseTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;
  ping(): Promise<boolean>;
  release(): Promise<void>;
}

export interface DatabaseHealthResult {
  readonly status: 'healthy' | 'unhealthy';
  readonly connectionName: string;
  readonly latencyMs: number;
  readonly error?: string | undefined;
}

/**
 * Structured document-database command, executed with `connection.execute()` on MongoDB
 * connections. Values may contain `{ $oid: '<24 hex>' }` markers, which the driver turns into
 * ObjectIds; ObjectIds in results are returned as hex strings.
 */
export type MongoCommand =
  | {
      readonly op: 'find';
      readonly collection: string;
      readonly filter?: Record<string, unknown> | undefined;
      readonly projection?: Record<string, 0 | 1> | undefined;
      readonly sort?: Record<string, 1 | -1> | undefined;
      readonly skip?: number | undefined;
      readonly limit?: number | undefined;
    }
  | { readonly op: 'aggregate'; readonly collection: string; readonly pipeline: readonly Record<string, unknown>[] }
  | { readonly op: 'count'; readonly collection: string; readonly filter?: Record<string, unknown> | undefined }
  | {
      readonly op: 'distinct';
      readonly collection: string;
      readonly field: string;
      readonly filter?: Record<string, unknown> | undefined;
    }
  | { readonly op: 'insertOne'; readonly collection: string; readonly document: Record<string, unknown> }
  | { readonly op: 'insertMany'; readonly collection: string; readonly documents: readonly Record<string, unknown>[] }
  | {
      readonly op: 'updateOne' | 'updateMany';
      readonly collection: string;
      readonly filter: Record<string, unknown>;
      readonly update: Record<string, unknown> | readonly Record<string, unknown>[];
      readonly upsert?: boolean | undefined;
    }
  | { readonly op: 'deleteOne' | 'deleteMany'; readonly collection: string; readonly filter: Record<string, unknown> }
  | {
      readonly op: 'findOneAndUpdate';
      readonly collection: string;
      readonly filter: Record<string, unknown>;
      readonly update: Record<string, unknown>;
      readonly upsert?: boolean | undefined;
      readonly returnDocument?: 'before' | 'after' | undefined;
    }
  | {
      readonly op: 'createCollection';
      readonly collection: string;
      readonly validator?: Record<string, unknown> | undefined;
      readonly validationLevel?: 'off' | 'strict' | 'moderate' | undefined;
      readonly validationAction?: 'error' | 'warn' | undefined;
    }
  | {
      readonly op: 'collMod';
      readonly collection: string;
      readonly validator?: Record<string, unknown> | undefined;
      readonly validationLevel?: 'off' | 'strict' | 'moderate' | undefined;
      readonly validationAction?: 'error' | 'warn' | undefined;
    }
  | { readonly op: 'dropCollection'; readonly collection: string }
  | { readonly op: 'renameCollection'; readonly collection: string; readonly to: string }
  | {
      readonly op: 'createIndex';
      readonly collection: string;
      readonly keys: Record<string, 1 | -1>;
      readonly name: string;
      readonly unique?: boolean | undefined;
      readonly sparse?: boolean | undefined;
      /** Index only documents matching this filter (e.g. unique-when-present). */
      readonly partialFilterExpression?: Record<string, unknown> | undefined;
    }
  | { readonly op: 'dropIndex'; readonly collection: string; readonly name: string }
  | { readonly op: 'listCollections' }
  | { readonly op: 'listIndexes'; readonly collection: string }
  | { readonly op: 'command'; readonly command: Record<string, unknown> };

/** Implemented by connections that accept structured document commands (MongoDB). */
export interface IDocumentExecutor {
  execute<T = Record<string, unknown>>(command: MongoCommand): Promise<DatabaseResult<T>>;
}
