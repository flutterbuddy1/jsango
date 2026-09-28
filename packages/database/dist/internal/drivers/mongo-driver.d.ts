import type { IDatabaseDriver, IDriverConnection, DatabaseCapabilities, DatabaseResult, QueryOptions } from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
export interface MongoDriverOptions {
    readonly url?: string | undefined;
    readonly database?: string | undefined;
}
export declare class MongoDriverConnection implements IDriverConnection {
    private _isClosed;
    private client;
    private db;
    readonly config: ConnectionConfig | MongoDriverOptions;
    constructor(config: ConnectionConfig | MongoDriverOptions, client?: any, db?: any);
    get isClosed(): boolean;
    query<T = Record<string, unknown>>(commandOrJson: string, params?: readonly unknown[], _options?: QueryOptions): Promise<DatabaseResult<T>>;
    ping(): Promise<boolean>;
    close(): Promise<void>;
}
export declare class MongoDatabaseDriver implements IDatabaseDriver {
    readonly name = "mongodb";
    readonly capabilities: DatabaseCapabilities;
    private client;
    private readonly config;
    constructor(config?: ConnectionConfig | MongoDriverOptions);
    connect(): Promise<IDriverConnection>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=mongo-driver.d.ts.map