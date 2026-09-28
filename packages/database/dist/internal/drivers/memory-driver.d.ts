import type { DatabaseCapabilities, DatabaseResult, IDatabaseDriver, IDriverConnection, QueryOptions } from '../../public/types.js';
interface TableRow {
    [column: string]: unknown;
}
export declare class MemoryDriverConnection implements IDriverConnection {
    private closed;
    private readonly tables;
    private snapshotStack;
    private savepoints;
    simulatedQueryDelayMs: number;
    shouldFailQuery: Error | null;
    constructor(sharedTables: Map<string, TableRow[]>);
    get isClosed(): boolean;
    ping(): Promise<boolean>;
    close(): Promise<void>;
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], options?: QueryOptions): Promise<DatabaseResult<T>>;
    private executeSql;
    private filterRows;
    private rowMatches;
    private evaluateCondition;
    private splitTopLevel;
    private splitCommaSeparated;
    private cloneTables;
    private restoreTables;
}
export declare class MemoryDatabaseDriver implements IDatabaseDriver {
    readonly name = "memory";
    readonly capabilities: DatabaseCapabilities;
    private readonly sharedTables;
    private readonly connections;
    private disconnected;
    connect(): Promise<IDriverConnection>;
    disconnect(): Promise<void>;
    /**
     * Helper to seed rows into the memory driver tables for testing.
     */
    seed(table: string, rows: TableRow[]): void;
    /**
     * Helper to inspect rows from the memory driver tables.
     */
    getTable(table: string): TableRow[];
    /**
     * Helper to retrieve all table names currently stored.
     */
    getTableNames(): string[];
}
export {};
//# sourceMappingURL=memory-driver.d.ts.map