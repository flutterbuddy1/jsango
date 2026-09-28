import { DatabaseConfigurationError, DatabaseError } from './errors.js';
import { DatabaseConnection } from './connection.js';
import { ConnectionPool } from '../internal/pool.js';
import { MemoryDatabaseDriver } from '../internal/drivers/memory-driver.js';
import { SqlDialect } from '../internal/dialect.js';
import { PostgresDatabaseDriver } from '../internal/drivers/postgres-driver.js';
import { MysqlDatabaseDriver } from '../internal/drivers/mysql-driver.js';
import { SqliteDatabaseDriver } from '../internal/drivers/sqlite-driver.js';
import { MongoDatabaseDriver } from '../internal/drivers/mongo-driver.js';
export class DatabaseManager {
    config;
    drivers = new Map();
    pools = new Map();
    dialects = new Map();
    telemetry;
    closed = false;
    constructor(config, options) {
        this.config = config;
        this.telemetry = options?.telemetry;
        // Register built-in drivers by default
        this.registerDriver('memory', new MemoryDatabaseDriver());
        this.registerDriver('sqlite', new SqliteDatabaseDriver());
        this.registerDriver('sqlite3', new SqliteDatabaseDriver());
        this.registerDriver('postgres', new PostgresDatabaseDriver());
        this.registerDriver('postgresql', new PostgresDatabaseDriver());
        this.registerDriver('pg', new PostgresDatabaseDriver());
        this.registerDriver('mysql', new MysqlDatabaseDriver());
        this.registerDriver('mariadb', new MysqlDatabaseDriver());
        this.registerDriver('mongodb', new MongoDatabaseDriver());
        this.registerDriver('mongo', new MongoDatabaseDriver());
    }
    registerDriver(name, driver) {
        this.drivers.set(name.toLowerCase(), driver);
        return this;
    }
    getDriver(name) {
        const driver = this.drivers.get(name.toLowerCase());
        if (!driver) {
            throw new DatabaseConfigurationError(`Database driver "${name}" is not registered in DatabaseManager.`);
        }
        return driver;
    }
    /**
     * Acquires a DatabaseConnection from the specified (or default) named pool.
     * Callers must ensure `await connection.release()` is called when finished.
     */
    async connection(name, options) {
        this.assertNotClosed();
        const connName = name ?? this.config.default;
        const pool = this.getOrCreatePool(connName);
        const connConfig = this.getConnectionConfig(connName);
        const driver = this.getDriver(connConfig.driver);
        const dialect = this.getOrCreateDialect(connConfig.driver, driver);
        const raw = await pool.acquire(options);
        return new DatabaseConnection(raw, pool, dialect, driver.capabilities, driver.name, this.telemetry);
    }
    /**
     * Acquires a DatabaseConnection from the default connection pool.
     */
    async defaultConnection(options) {
        return this.connection(this.config.default, options);
    }
    /**
     * High-level convenience method: acquires a connection, runs the query,
     * and guarantees release back to the pool in a finally block.
     */
    async query(sql, params, options) {
        const conn = await this.defaultConnection({
            timeoutMs: options?.timeoutMs,
            signal: options?.signal,
        });
        try {
            return await conn.query(sql, params, options);
        }
        finally {
            await conn.release();
        }
    }
    /**
     * High-level convenience method: acquires a connection, runs a scoped transaction,
     * commits or rolls back, and guarantees release back to the pool in a finally block.
     */
    async transaction(callback, options) {
        const conn = await this.defaultConnection({
            timeoutMs: options?.timeoutMs,
        });
        try {
            return await conn.transaction(callback, options);
        }
        finally {
            await conn.release();
        }
    }
    /**
     * Performs a health check across all configured connections (or a specific named connection).
     */
    async health(name) {
        const namesToCheck = name ? [name] : Object.keys(this.config.connections);
        const results = [];
        for (const connName of namesToCheck) {
            const startTime = Date.now();
            try {
                const conn = await this.connection(connName, { timeoutMs: 3000 });
                try {
                    await conn.query('SELECT 1');
                    results.push({
                        status: 'healthy',
                        connectionName: connName,
                        latencyMs: Date.now() - startTime,
                    });
                }
                finally {
                    await conn.release();
                }
            }
            catch (err) {
                results.push({
                    status: 'unhealthy',
                    connectionName: connName,
                    latencyMs: Date.now() - startTime,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return results;
    }
    /**
     * Drains all connection pools and disconnects drivers for graceful application shutdown.
     */
    async close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        // Close all pools
        const poolCloses = Array.from(this.pools.values()).map((p) => p.close());
        await Promise.all(poolCloses);
        this.pools.clear();
        // Disconnect all drivers
        const driverDisconnects = Array.from(this.drivers.values()).map((d) => d.disconnect());
        await Promise.all(driverDisconnects);
        this.drivers.clear();
    }
    getOrCreatePool(name) {
        const existing = this.pools.get(name);
        if (existing) {
            return existing;
        }
        const connConfig = this.getConnectionConfig(name);
        const driver = this.getDriver(connConfig.driver);
        const pool = new ConnectionPool(() => driver.connect(), connConfig.pool, name);
        this.pools.set(name, pool);
        return pool;
    }
    getOrCreateDialect(driverName, driver) {
        const existing = this.dialects.get(driverName);
        if (existing) {
            return existing;
        }
        const dialect = new SqlDialect(driver.capabilities.placeholderType);
        this.dialects.set(driverName, dialect);
        return dialect;
    }
    getConnectionConfig(name) {
        const config = this.config.connections[name];
        if (!config) {
            throw new DatabaseConfigurationError(`Database connection "${name}" is not configured in DatabaseConfig.`);
        }
        return config;
    }
    assertNotClosed() {
        if (this.closed) {
            throw new DatabaseError({
                code: 'ERR_DB_MANAGER_CLOSED',
                message: 'DatabaseManager has already been closed.',
            });
        }
    }
}
//# sourceMappingURL=manager.js.map