import type { IDatabaseConnection, IDatabaseTransaction, DatabaseResult, DatabaseCapabilities, IDatabaseDriver, IDriverConnection, QueryOptions, TransactionOptions } from '@jsango/database';
import { DatabaseManager } from '@jsango/database';
type TableRow = Record<string, unknown>;
export declare class MockDatabaseConnection implements IDatabaseConnection, IDriverConnection {
    readonly tables: Map<string, TableRow[]>;
    readonly executedQueries: {
        sql: string;
        params: unknown[];
    }[];
    readonly isReleased = false;
    private transactionSnapshots;
    readonly capabilities: DatabaseCapabilities;
    readonly driver: IDatabaseDriver;
    get isClosed(): boolean;
    isAlive(): Promise<boolean>;
    ping(): Promise<boolean>;
    close(): Promise<void>;
    release(): Promise<void>;
    getTable(name: string): TableRow[];
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], _options?: QueryOptions): Promise<DatabaseResult<T>>;
    beginTransaction(_options?: TransactionOptions): Promise<IDatabaseTransaction>;
    transaction<T>(callback: (tx: IDatabaseTransaction) => Promise<T>, options?: TransactionOptions): Promise<T>;
    private cloneTables;
    private restoreTables;
    private getMatchingIndices;
    private filterRows;
    private rowMatches;
    private singleConditionMatches;
}
export declare function createTestDatabase(): {
    connection: MockDatabaseConnection;
    manager: DatabaseManager;
};
export declare function resetTestState(): void;
export {};
//# sourceMappingURL=test-utils.d.ts.map