import type { DatabaseHealthResult, DatabaseResult, IDatabaseConnection, IDatabaseDriver, IDatabaseTransaction, QueryOptions, TransactionOptions } from './types.js';
import type { DatabaseConfig } from './config.js';
import { type QueryTelemetryHook } from './connection.js';
export interface DatabaseManagerOptions {
    readonly telemetry?: QueryTelemetryHook | undefined;
}
export declare class DatabaseManager {
    private readonly config;
    private readonly drivers;
    private readonly pools;
    private readonly dialects;
    private readonly telemetry?;
    private closed;
    constructor(config: DatabaseConfig, options?: DatabaseManagerOptions);
    registerDriver(name: string, driver: IDatabaseDriver): this;
    getDriver(name: string): IDatabaseDriver;
    /**
     * Acquires a DatabaseConnection from the specified (or default) named pool.
     * Callers must ensure `await connection.release()` is called when finished.
     */
    connection(name?: string, options?: {
        timeoutMs?: number | undefined;
        signal?: AbortSignal | undefined;
    }): Promise<IDatabaseConnection>;
    /**
     * Acquires a DatabaseConnection from the default connection pool.
     */
    defaultConnection(options?: {
        timeoutMs?: number | undefined;
        signal?: AbortSignal | undefined;
    }): Promise<IDatabaseConnection>;
    /**
     * High-level convenience method: acquires a connection, runs the query,
     * and guarantees release back to the pool in a finally block.
     */
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], options?: QueryOptions): Promise<DatabaseResult<T>>;
    /**
     * High-level convenience method: acquires a connection, runs a scoped transaction,
     * commits or rolls back, and guarantees release back to the pool in a finally block.
     */
    transaction<T>(callback: (tx: IDatabaseTransaction) => Promise<T>, options?: TransactionOptions): Promise<T>;
    /**
     * Performs a health check across all configured connections (or a specific named connection).
     */
    health(name?: string): Promise<DatabaseHealthResult[]>;
    /**
     * Drains all connection pools and disconnects drivers for graceful application shutdown.
     */
    close(): Promise<void>;
    private getOrCreatePool;
    private getOrCreateDialect;
    private getConnectionConfig;
    private assertNotClosed;
}
//# sourceMappingURL=manager.d.ts.map