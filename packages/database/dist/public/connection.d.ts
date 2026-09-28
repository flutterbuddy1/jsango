import type { DatabaseCapabilities, DatabaseResult, IDatabaseConnection, IDatabaseTransaction, IDriverConnection, QueryOptions, TransactionOptions } from './types.js';
import type { SqlDialect } from '../internal/dialect.js';
import type { ConnectionPool } from '../internal/pool.js';
export interface QueryTelemetryHook {
    onQueryStart?: (sql: string, params: readonly unknown[]) => void;
    onQueryEnd?: (sql: string, durationMs: number, rowCount: number) => void;
    onQueryError?: (sql: string, durationMs: number, error: unknown) => void;
}
export declare class DatabaseConnection implements IDatabaseConnection {
    private readonly rawConnection;
    private readonly pool;
    private readonly dialect;
    private readonly capabilities;
    private readonly driverName;
    private readonly telemetry?;
    private released;
    private activeTransaction;
    constructor(rawConnection: IDriverConnection, pool: ConnectionPool, dialect: SqlDialect, capabilities: DatabaseCapabilities, driverName: string, telemetry?: QueryTelemetryHook);
    get isReleased(): boolean;
    ping(): Promise<boolean>;
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], options?: QueryOptions): Promise<DatabaseResult<T>>;
    beginTransaction(options?: TransactionOptions): Promise<IDatabaseTransaction>;
    transaction<T>(callback: (tx: IDatabaseTransaction) => Promise<T>, options?: TransactionOptions): Promise<T>;
    release(): Promise<void>;
    private assertNotReleased;
}
//# sourceMappingURL=connection.d.ts.map