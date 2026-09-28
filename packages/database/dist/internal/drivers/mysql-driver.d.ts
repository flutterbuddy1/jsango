import type { IDatabaseDriver, IDriverConnection, DatabaseCapabilities, DatabaseResult, QueryOptions } from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
export interface MysqlDriverOptions {
    readonly url?: string | undefined;
    readonly host?: string | undefined;
    readonly port?: number | undefined;
    readonly database?: string | undefined;
    readonly user?: string | undefined;
    readonly password?: string | undefined;
    readonly ssl?: boolean | Record<string, unknown> | undefined;
}
export declare class MysqlDriverConnection implements IDriverConnection {
    private _isClosed;
    private connection;
    readonly config: ConnectionConfig | MysqlDriverOptions;
    constructor(config: ConnectionConfig | MysqlDriverOptions, connection?: any);
    get isClosed(): boolean;
    query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], _options?: QueryOptions): Promise<DatabaseResult<T>>;
    ping(): Promise<boolean>;
    close(): Promise<void>;
}
export declare class MysqlDatabaseDriver implements IDatabaseDriver {
    readonly name = "mysql";
    readonly capabilities: DatabaseCapabilities;
    private pool;
    private readonly config;
    constructor(config?: ConnectionConfig | MysqlDriverOptions);
    connect(): Promise<IDriverConnection>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=mysql-driver.d.ts.map