import { ConnectionError, IsolationLevelUnsupportedError, QueryError } from './errors.js';
import { DatabaseTransaction } from './transaction.js';
export class DatabaseConnection {
    rawConnection;
    pool;
    dialect;
    capabilities;
    driverName;
    telemetry;
    released = false;
    activeTransaction = null;
    constructor(rawConnection, pool, dialect, capabilities, driverName, telemetry) {
        this.rawConnection = rawConnection;
        this.pool = pool;
        this.dialect = dialect;
        this.capabilities = capabilities;
        this.driverName = driverName;
        this.telemetry = telemetry;
    }
    get isReleased() {
        return this.released;
    }
    async ping() {
        this.assertNotReleased();
        return this.rawConnection.ping();
    }
    async query(sql, params, options) {
        this.assertNotReleased();
        const normalizedSql = this.dialect.normalizePlaceholders(sql);
        const startTime = Date.now();
        this.telemetry?.onQueryStart?.(normalizedSql, params ?? []);
        try {
            const result = await this.rawConnection.query(normalizedSql, params, options);
            const duration = Date.now() - startTime;
            this.telemetry?.onQueryEnd?.(normalizedSql, duration, result.rowCount);
            return result;
        }
        catch (err) {
            const duration = Date.now() - startTime;
            this.telemetry?.onQueryError?.(normalizedSql, duration, err);
            if (err instanceof QueryError) {
                throw err;
            }
            throw new QueryError(`Database query failed: ${err instanceof Error ? err.message : String(err)}`, normalizedSql, err);
        }
    }
    async beginTransaction(options) {
        this.assertNotReleased();
        if (this.activeTransaction && !this.activeTransaction.isCompleted) {
            throw new ConnectionError('A transaction is already active on this connection. Nested transactions are not supported without savepoints.');
        }
        if (options?.isolationLevel) {
            if (!this.capabilities.supportsIsolationLevels) {
                throw new IsolationLevelUnsupportedError(options.isolationLevel, this.driverName);
            }
            const supported = this.capabilities.supportedIsolationLevels ?? [];
            if (!supported.includes(options.isolationLevel)) {
                throw new IsolationLevelUnsupportedError(options.isolationLevel, this.driverName);
            }
        }
        let beginSql = 'BEGIN';
        if (options?.isolationLevel) {
            beginSql = `BEGIN TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`;
        }
        await this.rawConnection.query(beginSql);
        const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const tx = new DatabaseTransaction(txId, this.rawConnection, this.dialect, () => {
            this.activeTransaction = null;
        });
        this.activeTransaction = tx;
        return tx;
    }
    async transaction(callback, options) {
        this.assertNotReleased();
        const tx = await this.beginTransaction(options);
        try {
            const result = await callback(tx);
            if (!tx.isCompleted) {
                await tx.commit();
            }
            return result;
        }
        catch (err) {
            if (!tx.isCompleted) {
                try {
                    await tx.rollback();
                }
                catch {
                    // Swallow rollback error in favor of throwing the original error
                }
            }
            throw err;
        }
    }
    async release() {
        if (this.released) {
            return;
        }
        this.released = true;
        // Rollback any uncommitted transaction before returning to pool
        if (this.activeTransaction && !this.activeTransaction.isCompleted) {
            try {
                await this.activeTransaction.rollback();
            }
            catch {
                // Ignore rollback failure during release
            }
            this.activeTransaction = null;
        }
        await this.pool.release(this.rawConnection);
    }
    assertNotReleased() {
        if (this.released) {
            throw new ConnectionError('Database connection has already been released back to the pool.');
        }
    }
}
//# sourceMappingURL=connection.js.map