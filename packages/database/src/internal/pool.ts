import type { IDriverConnection } from '../public/types.js';
import type { PoolConfig } from '../public/config.js';
import { DEFAULT_POOL_CONFIG } from '../public/config.js';
import {
  ConnectionAcquisitionTimeoutError,
  DatabaseError,
  ConnectionError,
} from '../public/errors.js';

interface PooledResource {
  readonly connection: IDriverConnection;
  readonly createdAt: number;
  lastUsedAt: number;
}

interface Waiter {
  readonly resolve: (conn: IDriverConnection) => void;
  readonly reject: (err: Error) => void;
  readonly timer: ReturnType<typeof setTimeout> | undefined;
  readonly signalCleanup?: (() => void) | undefined;
}

interface InternalPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  maxLifetimeMs: number;
}

export class ConnectionPool {
  private readonly factory: () => Promise<IDriverConnection>;
  private readonly config: InternalPoolConfig;
  private readonly connectionName: string;

  private readonly idle: PooledResource[] = [];
  private readonly active = new Set<IDriverConnection>();
  private readonly waiters: Waiter[] = [];
  private closed = false;
  private reapingInterval: ReturnType<typeof setInterval> | undefined;

  constructor(
    factory: () => Promise<IDriverConnection>,
    config?: PoolConfig,
    connectionName = 'default'
  ) {
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

  public get isClosed(): boolean {
    return this.closed;
  }

  public get size(): number {
    return this.idle.length + this.active.size;
  }

  public get idleCount(): number {
    return this.idle.length;
  }

  public get activeCount(): number {
    return this.active.size;
  }

  public get pendingCount(): number {
    return this.waiters.length;
  }

  /**
   * Initializes the pool and optionally creates minimum baseline connections.
   */
  public async initialize(): Promise<void> {
    if (this.closed) {
      throw new DatabaseError({
        code: 'ERR_DB_POOL_CLOSED',
        message: `Cannot initialize closed connection pool "${this.connectionName}".`,
      });
    }

    // Warm up minimum connections
    const warmups: Promise<void>[] = [];
    for (let i = 0; i < this.config.min; i++) {
      warmups.push(
        (async () => {
          try {
            const raw = await this.factory();
            this.idle.push({
              connection: raw,
              createdAt: Date.now(),
              lastUsedAt: Date.now(),
            });
          } catch (err) {
            // Log or allow lazy retry on demand
            throw new ConnectionError(
              `Failed to warm up connection for pool "${this.connectionName}": ${err instanceof Error ? err.message : String(err)}`,
              err
            );
          }
        })()
      );
    }

    await Promise.all(warmups);
  }

  /**
   * Acquires a connection from the pool or waits until one becomes available.
   */
  public async acquire(options?: {
    timeoutMs?: number | undefined;
    signal?: AbortSignal | undefined;
  }): Promise<IDriverConnection> {
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
      if (!resource) break;

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
      } catch (err) {
        throw new ConnectionError(
          `Failed to create database connection for pool "${this.connectionName}": ${err instanceof Error ? err.message : String(err)}`,
          err
        );
      }
    }

    // 3. Pool is at capacity: enqueue waiter with timeout
    const timeoutMs = options?.timeoutMs ?? this.config.acquireTimeoutMs;

    return new Promise<IDriverConnection>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let signalCleanup: (() => void) | undefined;

      const removeWaiter = () => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
        }
        if (timer) clearTimeout(timer);
        if (signalCleanup) signalCleanup();
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
          reject(
            new DatabaseError({
              code: 'ERR_DB_OPERATION_ABORTED',
              message: 'Database connection acquisition was aborted by client signal.',
            })
          );
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
  public async release(conn: IDriverConnection): Promise<void> {
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
      if (!nextWaiter) break;

      if (nextWaiter.timer) clearTimeout(nextWaiter.timer);
      if (nextWaiter.signalCleanup) nextWaiter.signalCleanup();

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
  public async destroy(conn: IDriverConnection): Promise<void> {
    this.active.delete(conn);
    await this.safeClose(conn);

    // If waiters exist, allocate a replacement connection
    if (this.waiters.length > 0 && !this.closed) {
      const waiter = this.waiters.shift();
      if (waiter) {
        if (waiter.timer) clearTimeout(waiter.timer);
        if (waiter.signalCleanup) waiter.signalCleanup();

        try {
          const replacement = await this.factory();
          this.active.add(replacement);
          waiter.resolve(replacement);
        } catch (err) {
          waiter.reject(
            new ConnectionError(
              `Failed to create replacement connection: ${err instanceof Error ? err.message : String(err)}`,
              err
            )
          );
        }
      }
    }
  }

  /**
   * Gracefully drains all idle and active connections, rejecting pending waiters.
   */
  public async close(): Promise<void> {
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
        if (waiter.timer) clearTimeout(waiter.timer);
        if (waiter.signalCleanup) waiter.signalCleanup();
        waiter.reject(
          new DatabaseError({
            code: 'ERR_DB_POOL_CLOSED',
            message: `Connection pool "${this.connectionName}" is shutting down.`,
          })
        );
      }
    }

    // Close all idle connections
    const closes: Promise<void>[] = [];
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

  private async safeClose(conn: IDriverConnection): Promise<void> {
    try {
      await conn.close();
    } catch {
      // Ignore errors on closing dead connections
    }
  }

  private assertNotClosed(): void {
    if (this.closed) {
      throw new DatabaseError({
        code: 'ERR_DB_POOL_CLOSED',
        message: `Database connection pool "${this.connectionName}" is closed.`,
      });
    }
  }
}
