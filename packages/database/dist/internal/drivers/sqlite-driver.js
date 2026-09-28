import { QueryError } from '../../public/errors.js';
import { MemoryDatabaseDriver } from './memory-driver.js';
export class SqliteDriverConnection {
    _isClosed = false;
    db = null;
    memoryFallback = null;
    config;
    constructor(config, db, memoryFallback) {
        this.config = config;
        this.db = db;
        this.memoryFallback = memoryFallback ?? null;
    }
    get isClosed() {
        return this._isClosed;
    }
    async query(sql, params = [], options) {
        if (this._isClosed) {
            throw new QueryError('Cannot execute query on closed SQLite connection.', sql);
        }
        if (this.db) {
            try {
                const trimmed = sql.trim().toUpperCase();
                const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN');
                if (isSelect) {
                    const stmt = this.db.prepare(sql);
                    const rows = stmt.all(...params);
                    return {
                        rows: Object.freeze(rows),
                        rowCount: rows.length,
                    };
                }
                else {
                    const stmt = this.db.prepare(sql);
                    const info = stmt.run(...params);
                    return {
                        rows: Object.freeze([]),
                        rowCount: info.changes ?? 0,
                        lastInsertId: info.lastInsertRowid !== undefined ? Number(info.lastInsertRowid) : undefined,
                    };
                }
            }
            catch (err) {
                throw new QueryError(`SQLite query failed: ${err instanceof Error ? err.message : String(err)}`, sql, err, { params });
            }
        }
        if (this.memoryFallback) {
            return this.memoryFallback.query(sql, params, options);
        }
        return {
            rows: Object.freeze([]),
            rowCount: 0,
        };
    }
    async ping() {
        if (this._isClosed)
            return false;
        return true;
    }
    async close() {
        if (this._isClosed)
            return;
        this._isClosed = true;
        if (this.db && typeof this.db.close === 'function') {
            try {
                this.db.close();
            }
            catch {
                // Ignore close errors on shutdown
            }
        }
        if (this.memoryFallback) {
            await this.memoryFallback.close();
        }
    }
}
export class SqliteDatabaseDriver {
    name = 'sqlite';
    capabilities = {
        supportsTransactions: true,
        supportsSavepoints: true,
        supportsIsolationLevels: false,
        supportsReturning: true,
        supportsCancellation: false,
        placeholderType: 'question',
        supportsTransactionalDDL: true,
    };
    config;
    constructor(config = {}) {
        this.config = config;
    }
    async connect() {
        const filename = this.config.filename ??
            this.config.database ??
            this.config.url?.replace(/^sqlite:\/\//, '') ??
            ':memory:';
        // 1. Try better-sqlite3
        try {
            const betterSqlite3 = await import('better-sqlite3');
            const DatabaseClass = betterSqlite3.default ?? betterSqlite3;
            if (DatabaseClass) {
                const db = new DatabaseClass(filename);
                return new SqliteDriverConnection(this.config, db);
            }
        }
        catch {
            // better-sqlite3 not installed
        }
        // 2. Try Node.js 22 built-in node:sqlite
        try {
            const nodeSqlite = await import('node:sqlite');
            const DatabaseSync = nodeSqlite.DatabaseSync;
            if (DatabaseSync) {
                const db = new DatabaseSync(filename);
                return new SqliteDriverConnection(this.config, db);
            }
        }
        catch {
            // node:sqlite not supported
        }
        // 3. Robust in-memory SQL engine fallback
        const memDriver = new MemoryDatabaseDriver();
        const memConn = await memDriver.connect();
        return new SqliteDriverConnection(this.config, null, memConn);
    }
    async disconnect() {
        // No-op for driver instance
    }
}
//# sourceMappingURL=sqlite-driver.js.map