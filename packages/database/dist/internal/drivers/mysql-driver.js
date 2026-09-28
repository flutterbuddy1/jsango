import { ConnectionError, QueryError } from '../../public/errors.js';
export class MysqlDriverConnection {
    _isClosed = false;
    connection = null;
    config;
    constructor(config, connection) {
        this.config = config;
        this.connection = connection;
    }
    get isClosed() {
        return this._isClosed;
    }
    async query(sql, params = [], _options) {
        if (this._isClosed) {
            throw new QueryError('Cannot execute query on closed MySQL connection.', sql);
        }
        if (this.connection && typeof this.connection.execute === 'function') {
            try {
                const [rows, fields] = await this.connection.execute(sql, [...params]);
                const resultRows = Array.isArray(rows) ? rows : [];
                const lastInsertId = rows?.insertId;
                const affectedRows = rows?.affectedRows ?? resultRows.length;
                return {
                    rows: Object.freeze(resultRows),
                    rowCount: affectedRows,
                    lastInsertId: lastInsertId ? Number(lastInsertId) : undefined,
                    fields: Array.isArray(fields)
                        ? fields.map((f) => ({
                            name: f.name,
                            type: String(f.type ?? 'unknown'),
                        }))
                        : undefined,
                };
            }
            catch (err) {
                throw new QueryError(`MySQL query failed: ${err instanceof Error ? err.message : String(err)}`, sql, err, { params });
            }
        }
        // Zero-dependency simulation fallback
        return {
            rows: Object.freeze([]),
            rowCount: 0,
        };
    }
    async ping() {
        if (this._isClosed)
            return false;
        try {
            if (this.connection && typeof this.connection.query === 'function') {
                await this.connection.query('SELECT 1');
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
        if (this.connection) {
            if (typeof this.connection.release === 'function') {
                await this.connection.release();
            }
            else if (typeof this.connection.end === 'function') {
                await this.connection.end();
            }
        }
    }
}
export class MysqlDatabaseDriver {
    name = 'mysql';
    capabilities = {
        supportsTransactions: true,
        supportsSavepoints: true,
        supportsIsolationLevels: true,
        supportsReturning: false,
        supportsCancellation: false,
        placeholderType: 'question',
        supportsTransactionalDDL: false,
        supportedIsolationLevels: ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'],
    };
    pool = null;
    config;
    constructor(config = {}) {
        this.config = config;
    }
    async connect() {
        // Attempt dynamic load of 'mysql2/promise' if installed
        if (!this.pool) {
            try {
                const mysql = await import('mysql2/promise');
                const createPool = mysql.default?.createPool ?? mysql.createPool;
                if (createPool) {
                    const cfg = this.config;
                    this.pool = createPool({
                        uri: cfg.url,
                        host: cfg.host,
                        port: cfg.port,
                        database: cfg.database,
                        user: cfg.username ?? cfg.user,
                        password: cfg.password,
                        ssl: cfg.ssl,
                        connectionLimit: cfg.pool?.max ?? 10,
                    });
                }
            }
            catch {
                // 'mysql2' package not installed, operates in mock / fallback mode
            }
        }
        if (this.pool) {
            try {
                const conn = await this.pool.getConnection();
                return new MysqlDriverConnection(this.config, conn);
            }
            catch (err) {
                throw new ConnectionError(`Failed to connect to MySQL database: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return new MysqlDriverConnection(this.config);
    }
    async disconnect() {
        if (this.pool && typeof this.pool.end === 'function') {
            await this.pool.end();
            this.pool = null;
        }
    }
}
//# sourceMappingURL=mysql-driver.js.map