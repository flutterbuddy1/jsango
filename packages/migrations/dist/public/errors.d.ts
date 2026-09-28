import { JsangoError } from '@jsango/core';
export declare class MigrationError extends JsangoError {
    constructor(options: {
        code?: string;
        message: string;
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
export declare class MigrationLockedError extends MigrationError {
    readonly ownerId?: string | undefined;
    readonly lockTimeoutMs?: number | undefined;
    constructor(message: string, ownerId?: string, lockTimeoutMs?: number);
}
export declare class DestructiveMigrationError extends MigrationError {
    readonly destructiveOperations: readonly string[];
    constructor(message: string, destructiveOperations: readonly string[]);
}
export declare class IrreversibleMigrationError extends MigrationError {
    readonly migrationId: string;
    readonly operationType?: string | undefined;
    constructor(migrationId: string, operationType?: string);
}
export declare class MigrationNotFoundError extends MigrationError {
    readonly migrationId: string;
    constructor(migrationId: string);
}
export declare class SchemaDiffError extends MigrationError {
    constructor(message: string, cause?: unknown);
}
//# sourceMappingURL=errors.d.ts.map