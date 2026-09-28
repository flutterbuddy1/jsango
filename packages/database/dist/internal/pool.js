import { DEFAULT_POOL_CONFIG } from '../public/config.js';
import { ConnectionAcquisitionTimeoutError, DatabaseError, ConnectionError, } from '../public/errors.js';
export class ConnectionPool {
    factory;
    config;
    connectionName;
    idle = [];
    active = new Set();
    waiters = [];
    closed = false;
    reapingInterval;
    constructor(factory, config, connectionName = 'default') {
        this.factory = factory;
        this.connectionName = connectionName;
        const min = config?.min ?? DEFAULT_POOL_CONFIG.min;
        const max = config?.max ?? DEFAULT_POOL_CONFIG.max;
        this.config = {
            min: min > max ? max : min,
            max,
            acquireTimeoutMs: config?.acquireTimeoutMs ?? DEFAULT_POOL_CONFIG.acquireTimeoutMs,
            idleTimeoutMs: config?.idleTimeoutMs ?? DEFAULT_POOL_CONFIG.idleTimeoutMs,
            connectionTimeoutMs: config?.connectionTimeoutMs ?? DEFAULT_POOL_CONFIG.connectionTimeoutMs,
            maxLifetimeMs: config?.maxLifetimeMs ?? DEFAULT_POOL_CONFIG.maxLifetimeMs,
        };
    }
    get isClosed() {
        return this.closed;
    }
    get size() {
        return this.idle.length + this.active.size;
    }
    get idleCount() {
        return this.idle.length;
    }
    get activeCount() {
        return this.active.size;
    }
    get pendingCount() {
        return this.waiters.length;
    }
    /**
     * Initializes the pool and optionally creates minimum baseline connections.
     */
    async initialize() {
        if (this.closed) {
            throw new DatabaseError({
                code: 'ERR_DB_POOL_CLOSED',
                message: `Cannot initialize closed connection pool "${this.connectionName}".`,
            });
        }
        // Warm up minimum connections
        const warmups = [];
        for (let i = 0; i < this.config.min; i++) {
            warmups.push((async () => {
                try {
                    const raw = await this.factory();
                    this.idle.push({
                        connection: raw,
                        createdAt: Date.now(),
                        lastUsedAt: Date.now(),
                    });
                }
                catch (err) {
                    // Log or allow lazy retry on demand
                    throw new ConnectionError(`Failed to warm up connection for pool "${this.connectionName}": ${err instanceof Error ? err.message : String(err)}`, err);
                }
            })());
        }
        await Promise.all(warmups);
    }
    /**
     * Acquires a connection from the pool or waits until one becomes available.
     */
    async acquire(options) {
        this.assertNotClosed();
        if (options?.signal?.aborted) {
            throw new DatabaseError({
                code: 'ERR_DB_OPERATION_ABORTED',
                message: 'Database connection acquisition was aborted.',
            });
        }
        // 1. Try to take an idle connection
        while (this.idle.length > 0) {
            const resource = this.idle.pop();
            if (!resource)
                break;
            const now = Date.now();
            const isExpired = now - resource.createdAt > this.config.maxLifetimeMs;
            const isIdleTimeout = now - resource.lastUsedAt > this.config.idleTimeoutMs;
            if (resource.connection.isClosed || isExpired || isIdleTimeout) {
                // Destroy stale or dead connection
                await this.safeClose(resource.connection);
                continue;
            }
            this.active.add(resource.connection);
            resource.lastUsedAt = now;
            return resource.connection;
        }
        // 2. If under max capacity, create a fresh connection
        if (this.size < this.config.max) {
            try {
                const raw = await this.factory();
                this.active.add(raw);
                return raw;
            }
            catch (err) {
                throw new ConnectionError(`Failed to create database connection for pool "${this.connectionName}": ${err instanceof Error ? err.message : String(err)}`, err);
            }
        }
        // 3. Pool is at capacity: enqueue waiter with timeout
        const timeoutMs = options?.timeoutMs ?? this.config.acquireTimeoutMs;
        return new Promise((resolve, reject) => {
            let timer;
            let signalCleanup;
            const removeWaiter = () => {
                const idx = this.waiters.findIndex((w) => w.resolve === resolve);
                if (idx !== -1) {
                    this.waiters.splice(idx, 1);
                }
                if (timer)
                    clearTimeout(timer);
                if (signalCleanup)
                    signalCleanup();
            };
            if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
                timer = setTimeout(() => {
                    removeWaiter();
                    reject(new ConnectionAcquisitionTimeoutError(timeoutMs, this.connectionName));
                }, timeoutMs);
            }
            if (options?.signal) {
                const onAbort = () => {
                    removeWaiter();
                    reject(new DatabaseError({
                        code: 'ERR_DB_OPERATION_ABORTED',
                        message: 'Database connection acquisition was aborted by client signal.',
                    }));
                };
                options.signal.addEventListener('abort', onAbort, { once: true });
                signalCleanup = () => options.signal?.removeEventListener('abort', onAbort);
            }
            this.waiters.push({ resolve, reject, timer, signalCleanup });
        });
    }
    /**
     * Releases an active connection back to the pool.
     */
    async release(conn) {
        if (!this.active.has(conn)) {
            return;
        }
        this.active.delete(conn);
        if (this.closed || conn.isClosed) {
            await this.safeClose(conn);
            return;
        }
        // Check if there are waiters in queue
        while (this.waiters.length > 0) {
            const nextWaiter = this.waiters.shift();
            if (!nextWaiter)
                break;
            if (nextWaiter.timer)
                clearTimeout(nextWaiter.timer);
            if (nextWaiter.signalCleanup)
                nextWaiter.signalCleanup();
            this.active.add(conn);
            nextWaiter.resolve(conn);
            return;
        }
        // Return to idle pool
        this.idle.push({
            connection: conn,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
        });
    }
    /**
     * Destroys an active connection and immediately evicts it from the pool.
     */
    async destroy(conn) {
        this.active.delete(conn);
        await this.safeClose(conn);
        // If waiters exist, allocate a replacement connection
        if (this.waiters.length > 0 && !this.closed) {
            const waiter = this.waiters.shift();
            if (waiter) {
                if (waiter.timer)
                    clearTimeout(waiter.timer);
                if (waiter.signalCleanup)
                    waiter.signalCleanup();
                try {
                    const replacement = await this.factory();
                    this.active.add(replacement);
                    waiter.resolve(replacement);
                }
                catch (err) {
                    waiter.reject(new ConnectionError(`Failed to create replacement connection: ${err instanceof Error ? err.message : String(err)}`, err));
                }
            }
        }
    }
    /**
     * Gracefully drains all idle and active connections, rejecting pending waiters.
     */
    async close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this.reapingInterval) {
            clearInterval(this.reapingInterval);
        }
        // Reject all pending waiters
        while (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            if (waiter) {
                if (waiter.timer)
                    clearTimeout(waiter.timer);
                if (waiter.signalCleanup)
                    waiter.signalCleanup();
                waiter.reject(new DatabaseError({
                    code: 'ERR_DB_POOL_CLOSED',
                    message: `Connection pool "${this.connectionName}" is shutting down.`,
                }));
            }
        }
        // Close all idle connections
        const closes = [];
        while (this.idle.length > 0) {
            const item = this.idle.pop();
            if (item) {
                closes.push(this.safeClose(item.connection));
            }
        }
        // Close active connections
        for (const activeConn of this.active) {
            closes.push(this.safeClose(activeConn));
        }
        this.active.clear();
        await Promise.all(closes);
    }
    async safeClose(conn) {
        try {
            await conn.close();
        }
        catch {
            // Ignore errors on closing dead connections
        }
    }
    assertNotClosed() {
        if (this.closed) {
            throw new DatabaseError({
                code: 'ERR_DB_POOL_CLOSED',
                message: `Database connection pool "${this.connectionName}" is closed.`,
            });
        }
    }
}
//# sourceMappingURL=pool.js.map