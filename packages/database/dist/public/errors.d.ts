import { JsangoError } from '@jsango/core';
export interface DatabaseErrorOptions {
    readonly message: string;
    readonly code?: string | undefined;
    readonly statusCode?: number | undefined;
    readonly cause?: unknown | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
}
export declare class DatabaseError extends JsangoError {
    constructor(options: DatabaseErrorOptions);
}
export declare class ConnectionError extends DatabaseError {
    constructor(message: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class ConnectionAcquisitionTimeoutError extends DatabaseError {
    constructor(timeoutMs: number, connectionName?: string);
}
export declare class PoolExhaustedError extends DatabaseError {
    constructor(maxSize: number, connectionName?: string);
}
export declare class QueryError extends DatabaseError {
    readonly sql: string;
    constructor(message: string, sql: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class TransactionError extends DatabaseError {
    constructor(message: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class TransactionClosedError extends TransactionError {
    constructor(action: string, state: 'committed' | 'rolledBack');
}
export declare class IsolationLevelUnsupportedError extends DatabaseError {
    constructor(level: string, driverName: string);
}
export declare class DatabaseConfigurationError extends DatabaseError {
    constructor(message: string, metadata?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map