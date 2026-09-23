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
  readonly supportedIsolationLevels?: readonly IsolationLevel[] | undefined;
}

export interface IDriverConnection {
  readonly isClosed: boolean;
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
  connect(): Promise<IDriverConnection>;
  disconnect(): Promise<void>;
}

export interface IDatabaseTransaction {
  readonly id: string;
  readonly isCompleted: boolean;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  savepoint(name: string): Promise<void>;
  rollbackTo(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
}

export type ITransaction = IDatabaseTransaction;

export interface IDatabaseConnection {
  readonly isReleased: boolean;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>>;
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
