import type { IDatabaseConnection } from '@jsango/database';
export interface MigrationLockOptions {
    readonly acquireTimeoutMs?: number | undefined;
    readonly lockExpiryMs?: number | undefined;
    readonly retryIntervalMs?: number | undefined;
    readonly ownerId?: string | undefined;
}
export declare class MigrationLock {
    static readonly TABLE_NAME = "jsango_migration_lock";
    private readonly connection;
    private readonly acquireTimeoutMs;
    private readonly lockExpiryMs;
    private readonly retryIntervalMs;
    private readonly ownerId;
    private isAcquired;
    constructor(connection: IDatabaseConnection, options?: MigrationLockOptions);
    get currentOwnerId(): string;
    get isLocked(): boolean;
    ensureTable(): Promise<void>;
    acquire(): Promise<void>;
    release(): Promise<void>;
    withLock<T>(fn: () => Promise<T>): Promise<T>;
    private tryAcquire;
}
//# sourceMappingURL=lock.d.ts.map