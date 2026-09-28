import type { IDriverConnection } from '../public/types.js';
import type { PoolConfig } from '../public/config.js';
export declare class ConnectionPool {
    private readonly factory;
    private readonly config;
    private readonly connectionName;
    private readonly idle;
    private readonly active;
    private readonly waiters;
    private closed;
    private reapingInterval;
    constructor(factory: () => Promise<IDriverConnection>, config?: PoolConfig, connectionName?: string);
    get isClosed(): boolean;
    get size(): number;
    get idleCount(): number;
    get activeCount(): number;
    get pendingCount(): number;
    /**
     * Initializes the pool and optionally creates minimum baseline connections.
     */
    initialize(): Promise<void>;
    /**
     * Acquires a connection from the pool or waits until one becomes available.
     */
    acquire(options?: {
        timeoutMs?: number | undefined;
        signal?: AbortSignal | undefined;
    }): Promise<IDriverConnection>;
    /**
     * Releases an active connection back to the pool.
     */
    release(conn: IDriverConnection): Promise<void>;
    /**
     * Destroys an active connection and immediately evicts it from the pool.
     */
    destroy(conn: IDriverConnection): Promise<void>;
    /**
     * Gracefully drains all idle and active connections, rejecting pending waiters.
     */
    close(): Promise<void>;
    private safeClose;
    private assertNotClosed;
}
//# sourceMappingURL=pool.d.ts.map