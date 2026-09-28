import { JsangoError } from '@jsango/core';
export class DatabaseError extends JsangoError {
    constructor(options) {
        super({
            code: options.code ?? 'ERR_DATABASE',
            message: options.message,
            statusCode: options.statusCode ?? 500,
            cause: options.cause,
            metadata: options.metadata,
        });
    }
}
export class ConnectionError extends DatabaseError {
    constructor(message, cause, metadata) {
        super({
            code: 'ERR_DB_CONNECTION',
            message,
            statusCode: 503,
            cause,
            metadata,
        });
    }
}
export class ConnectionAcquisitionTimeoutError extends DatabaseError {
    constructor(timeoutMs, connectionName = 'default') {
        super({
            code: 'ERR_DB_POOL_TIMEOUT',
            message: `Timed out acquiring database connection "${connectionName}" after ${timeoutMs}ms.`,
            statusCode: 504,
            metadata: { timeoutMs, connectionName },
        });
    }
}
export class PoolExhaustedError extends DatabaseError {
    constructor(maxSize, connectionName = 'default') {
        super({
            code: 'ERR_DB_POOL_EXHAUSTED',
            message: `Database connection pool "${connectionName}" is exhausted (max capacity: ${maxSize}).`,
            statusCode: 503,
            metadata: { maxSize, connectionName },
        });
    }
}
export class QueryError extends DatabaseError {
    sql;
    constructor(message, sql, cause, metadata) {
        super({
            code: 'ERR_DB_QUERY',
            message,
            statusCode: 500,
            cause,
            metadata: { ...metadata, sql },
        });
        this.sql = sql;
    }
}
export class TransactionError extends DatabaseError {
    constructor(message, cause, metadata) {
        super({
            code: 'ERR_DB_TRANSACTION',
            message,
            statusCode: 500,
            cause,
            metadata,
        });
    }
}
export class TransactionClosedError extends TransactionError {
    constructor(action, state) {
        super(`Cannot ${action} on transaction because it has already been ${state}.`, undefined, {
            action,
            state,
        });
    }
}
export class IsolationLevelUnsupportedError extends DatabaseError {
    constructor(level, driverName) {
        super({
            code: 'ERR_DB_ISOLATION_UNSUPPORTED',
            message: `Transaction isolation level "${level}" is not supported by driver "${driverName}".`,
            statusCode: 400,
            metadata: { level, driverName },
        });
    }
}
export class DatabaseConfigurationError extends DatabaseError {
    constructor(message, metadata) {
        super({
            code: 'ERR_DB_CONFIG',
            message,
            statusCode: 500,
            metadata,
        });
    }
}
//# sourceMappingURL=errors.js.map