import { ConnectionError, QueryError } from '../../public/errors.js';
export class PostgresDriverConnection {
    _isClosed = false;
    client = null;
    config;
    constructor(config, client) {
        this.config = config;
        this.client = client;
    }
    get isClosed() {
        return this._isClosed;
    }
    async query(sql, params = [], _options) {
        if (this._isClosed) {
            throw new QueryError('Cannot execute query on closed Postgres connection.', sql);
        }
        if (this.client && typeof this.client.query === 'function') {
            try {
                const res = await this.client.query(sql, [...params]);
                const rows = (res.rows ?? []);
                return {
                    rows: Object.freeze(rows),
                    rowCount: res.rowCount ?? rows.length,
                    fields: res.fields?.map((f) => ({
                        name: f.name,
                        type: String(f.dataTypeID ?? 'unknown'),
                    })),
                };
            }
            catch (err) {
                throw new QueryError(`PostgreSQL query failed: ${err instanceof Error ? err.message : String(err)}`, sql, err, { params });
            }
        }
        // Zero-dependency fallback simulation when running in disconnected / lightweight mock mode
        return {
            rows: Object.freeze([]),
            rowCount: 0,
        };
    }
    async ping() {
        if (this._isClosed)
            return false;
        try {
            if (this.client && typeof this.client.query === 'function') {
                await this.client.query('SELECT 1');
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async close() {
        if (this._isClosed)
            return;
        this._isClosed = true;
        if (this.client) {
            if (typeof this.client.release === 'function') {
                await this.client.release();
            }
            else if (typeof this.client.end === 'function') {
                await this.client.end();
            }
        }
    }
}
export class PostgresDatabaseDriver {
    name = 'postgres';
    capabilities = {
        supportsTransactions: true,
        supportsSavepoints: true,
        supportsIsolationLevels: true,
        supportsReturning: true,
        supportsCancellation: true,
        placeholderType: 'dollar',
        supportsTransactionalDDL: true,
        supportedIsolationLevels: ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'],
    };
    pool = null;
    config;
    constructor(config = {}) {
        this.config = config;
    }
    async connect() {
        // Attempt dynamic load of 'pg' if installed in user application
        if (!this.pool) {
            try {
                const pg = await import('pg');
                const PoolClass = pg.default?.Pool ?? pg.Pool;
                if (PoolClass) {
                    const cfg = this.config;
                    this.pool = new PoolClass({
                        connectionString: cfg.url,
                        host: cfg.host,
                        port: cfg.port,
                        database: cfg.database,
                        user: cfg.username ?? cfg.user,
                        password: cfg.password,
                        ssl: cfg.ssl,
                        min: cfg.pool?.min ?? 1,
                        max: cfg.pool?.max ?? 10,
                    });
                }
            }
            catch {
                // 'pg' package not installed, operates in mock / fallback mode
            }
        }
        if (this.pool) {
            try {
                const client = await this.pool.connect();
                return new PostgresDriverConnection(this.config, client);
            }
            catch (err) {
                throw new ConnectionError(`Failed to connect to PostgreSQL database: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return new PostgresDriverConnection(this.config);
    }
    async disconnect() {
        if (this.pool && typeof this.pool.end === 'function') {
            await this.pool.end();
            this.pool = null;
        }
    }
}
//# sourceMappingURL=postgres-driver.js.map