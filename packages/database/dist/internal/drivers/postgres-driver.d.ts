import type { IDatabaseDriver, IDriverConnection, DatabaseCapabilities, DatabaseResult, QueryOptions } from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
export interface PostgresDriverOptions {
    readonly url?: string | undefined;
    readonly host?: string | undefined;
    readonly port?: number | undefined;
    readonly database?: string | undefined;
    readonly user?: string | undefined;
    readonly password?: string | undefined;
    readonly ssl?: boolean | Record<string, unknown> | undefined;
}
export declare class PostgresDriverConnection implements IDriverConnection {
    private _isClosed;
    private client;
    readonly config: ConnectionConfig | PostgresDriverOptions;
    constructor(config: ConnectionConfig | PostgresDriverOptions, client?: any);
    get isClosed(): boolean;
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], _options?: QueryOptions): Promise<DatabaseResult<T>>;
    ping(): Promise<boolean>;
    close(): Promise<void>;
}
export declare class PostgresDatabaseDriver implements IDatabaseDriver {
    readonly name = "postgres";
    readonly capabilities: DatabaseCapabilities;
    private pool;
    private readonly config;
    constructor(config?: ConnectionConfig | PostgresDriverOptions);
    connect(): Promise<IDriverConnection>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=postgres-driver.d.ts.map