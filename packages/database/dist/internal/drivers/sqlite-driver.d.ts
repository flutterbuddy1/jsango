import type { IDatabaseDriver, IDriverConnection, DatabaseCapabilities, DatabaseResult, QueryOptions } from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
export interface SqliteDriverOptions {
    readonly filename?: string | undefined;
    readonly url?: string | undefined;
    readonly readonly?: boolean | undefined;
}
export declare class SqliteDriverConnection implements IDriverConnection {
    private _isClosed;
    private db;
    private memoryFallback;
    readonly config: ConnectionConfig | SqliteDriverOptions;
    constructor(config: ConnectionConfig | SqliteDriverOptions, db?: any, memoryFallback?: IDriverConnection);
    get isClosed(): boolean;
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], options?: QueryOptions): Promise<DatabaseResult<T>>;
    ping(): Promise<boolean>;
    close(): Promise<void>;
}
export declare class SqliteDatabaseDriver implements IDatabaseDriver {
    readonly name = "sqlite";
    readonly capabilities: DatabaseCapabilities;
    private readonly config;
    constructor(config?: ConnectionConfig | SqliteDriverOptions);
    connect(): Promise<IDriverConnection>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=sqlite-driver.d.ts.map